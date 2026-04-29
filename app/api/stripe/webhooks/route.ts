/**
 * @file route.ts
 * @description Stripe webhook handler. Creates orders on
 *   payment_intent.succeeded from metadata embedded by /api/stripe/checkout-session
 *   (school_id, restaurant_name, cart_screenshot_paths, subtotal_cents). The
 *   60/50/10 split is re-derived server-side via lib/pricing.ts:computeSplit
 *   so a tampered total_cents / platform_fee_cents in metadata can't change
 *   what we persist. Idempotent via the unique index on
 *   payments.stripe_payment_intent_id; an orphan order from a partially-failed
 *   prior attempt is recovered by PI ID lookup. Marks swipers active on
 *   account.updated when Stripe Connect onboarding completes.
 *   Called by: Stripe webhook delivery (not directly by app code)
 * @dependencies lib/stripe/client.ts, lib/supabase/service.ts, lib/api/helpers.ts, lib/pricing.ts
 */

import { NextRequest } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/service'
import { apiError, apiSuccess } from '@/lib/api/helpers'
import { computeSplit } from '@/lib/pricing'
import type Stripe from 'stripe'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SCREENSHOT_PATH_RE =
  /^pre-checkout\/[A-Za-z0-9_-]{10}\/[0-9a-fA-F-]{36}\.(?:png|jpg|jpeg|webp|heic|heif)$/

export const dynamic = 'force-dynamic'

/**
 * Handles Stripe webhook events: creates orders on payment_intent.succeeded, marks swipers active on account.updated.
 * @returns JSON { received: true } on success; 400/500 on signature validation or processing errors
 * @called-by Stripe webhook delivery
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return apiError('Server configuration error', 500)
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature) return apiError('Missing stripe-signature header', 400)

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    console.warn('webhook: invalid signature — check STRIPE_WEBHOOK_SECRET matches stripe listen output')
    return apiError('Invalid webhook signature', 400)
  }

  console.log(`webhook received: ${event.type}`, { eventId: event.id })

  const supabase = createServiceClient()

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent
      const result = await handlePaymentIntentSucceeded(pi, supabase)
      if (result) return result
      break
    }

    case 'payment_intent.payment_failed': {
      // No-op for checkout flow: no order exists in our DB until
      // payment_intent.succeeded fires.
      break
    }

    case 'checkout.session.completed': {
      // No-op: order creation is handled by payment_intent.succeeded.
      const session = event.data.object as Stripe.Checkout.Session
      console.log(`checkout.session.completed: session ${session.id} (no-op)`)
      break
    }

    case 'checkout.session.expired': {
      // No-op: no order exists to clean up.
      break
    }

    case 'account.updated': {
      const account = event.data.object as Stripe.Account
      await handleAccountUpdated(account, supabase)
      break
    }
  }

  return apiSuccess({ received: true })
}

// --- Helpers ---

type ServiceClient = ReturnType<typeof createServiceClient>

/**
 * Validates and persists an order + payment from a successful PaymentIntent.
 * @param pi - The Stripe PaymentIntent that just succeeded
 * @param supabase - Service-role Supabase client (bypasses RLS for inserts)
 * @returns A NextResponse error to short-circuit the webhook (signal Stripe to retry), or null on success/no-op
 * @called-by POST handler above
 */
async function handlePaymentIntentSucceeded(
  pi: Stripe.PaymentIntent,
  supabase: ServiceClient
): Promise<Response | null> {
  const meta = pi.metadata
  console.log('payment_intent.succeeded: processing', {
    piId: pi.id,
    isGuest: meta.is_guest === 'true',
  })

  const isGuest = meta.is_guest === 'true'
  // Cap guest_name to the same 100-char ceiling as the request schema to
  // defend against metadata tampering by a compromised platform key.
  const guestName = isGuest ? (meta.guest_name ?? '').slice(0, 100) || null : null
  const ordererId = isGuest ? null : meta.orderer_id

  const validation = validatePaymentIntentMetadata(meta, isGuest, guestName, ordererId)
  if (!validation.ok) {
    console.warn(`payment_intent.succeeded: skip — ${validation.reason}`, { piId: pi.id })
    return null
  }
  const { schoolId, restaurantName, subtotalCents, screenshotPaths } = validation
  // Re-derive the split server-side from the validated subtotal so a tampered
  // total_cents / platform_fee_cents in metadata can't change what we persist.
  const split = computeSplit(subtotalCents)

  // Idempotency: skip if payment already recorded for this PI.
  const { data: existingPayment, error: paymentCheckError } = await supabase
    .from('payments')
    .select('id')
    .eq('stripe_payment_intent_id', pi.id)
    .maybeSingle()

  if (paymentCheckError) {
    console.error('payment_intent.succeeded: idempotency check failed', {
      piId: pi.id,
      error: paymentCheckError,
    })
    return apiError('Failed to check payment', 500)
  }

  if (existingPayment) {
    console.log('payment_intent.succeeded: skip — duplicate delivery', { piId: pi.id })
    return null
  }

  // Create order — unified path for guest and auth.
  // stripe_payment_intent_id has a unique index, so on retry (when the previous
  // attempt created the order but payment insert failed) the insert fails and
  // we recover the existing order below.
  let orderId: string
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      orderer_id: ordererId,
      school_id: schoolId,
      restaurant_name: restaurantName,
      cart_screenshot_urls: screenshotPaths,
      stripe_payment_intent_id: pi.id,
      subtotal_cents: split.subtotalCents,
      total_cents: split.ordererPaysCents,
      guest_name: guestName,
      guest_email: null,
      guest_access_token: isGuest ? crypto.randomUUID() : null,
    })
    .select('id')
    .single()

  if (orderError) {
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('stripe_payment_intent_id', pi.id)
      .single()

    if (!existing) {
      console.error('payment_intent.succeeded: failed to create order', orderError)
      return apiError('Failed to create order', 500)
    }
    orderId = existing.id
  } else {
    orderId = order.id
  }

  const { error: paymentError } = await supabase.from('payments').insert({
    order_id: orderId,
    stripe_payment_intent_id: pi.id,
    amount_cents: split.ordererPaysCents,
    platform_fee_cents: split.platformFeeCents,
    status: 'succeeded',
    payer_id: ordererId,
    payee_id: null,
  })

  if (paymentError) {
    console.error('payment_intent.succeeded: failed to record payment', paymentError)
    return apiError('Failed to record payment', 500)
  }

  return null
}

type MetadataOk = {
  ok: true
  schoolId: string
  restaurantName: string
  subtotalCents: number
  screenshotPaths: string[]
}

type MetadataErr = { ok: false; reason: string }

/**
 * Validates the Stripe metadata required to create an order; rejects
 * malformed UUIDs, missing fields, oversized restaurant_name, and any
 * screenshot path that does not match the canonical pre-checkout layout.
 * @param meta - Raw metadata from the PaymentIntent
 * @param isGuest - True when the metadata indicates a guest checkout
 * @param guestName - Pre-extracted guest name (or null for auth flow)
 * @param ordererId - Pre-extracted orderer id (or null for guest flow)
 * @returns Discriminated union: ok=true with parsed fields, or ok=false with a reason
 * @called-by handlePaymentIntentSucceeded
 */
function validatePaymentIntentMetadata(
  meta: Stripe.Metadata,
  isGuest: boolean,
  guestName: string | null | undefined,
  ordererId: string | null | undefined
): MetadataOk | MetadataErr {
  const schoolId = meta.school_id
  const restaurantName = meta.restaurant_name
  const subtotalCentsRaw = meta.subtotal_cents
  const screenshotPathsRaw = meta.cart_screenshot_paths

  if (!schoolId) return { ok: false, reason: 'missing school_id' }
  if (!UUID_RE.test(schoolId)) return { ok: false, reason: 'invalid school_id UUID' }
  if (!restaurantName) return { ok: false, reason: 'missing restaurant_name' }
  const trimmed = restaurantName.trim()
  if (trimmed.length < 1 || trimmed.length > 80) {
    return { ok: false, reason: 'restaurant_name length out of range' }
  }
  if (!subtotalCentsRaw) return { ok: false, reason: 'missing subtotal_cents' }
  const subtotalCents = parseInt(subtotalCentsRaw, 10)
  // Mirrors createCheckoutSchema bounds in lib/types/api.ts. Defends against
  // post-checkout metadata tampering by a compromised platform key.
  if (!Number.isInteger(subtotalCents) || subtotalCents < 50 || subtotalCents > 50_000) {
    return { ok: false, reason: 'invalid subtotal_cents' }
  }
  if (!screenshotPathsRaw) return { ok: false, reason: 'missing cart_screenshot_paths' }
  const screenshotPaths = screenshotPathsRaw.split(',').map((p) => p.trim()).filter(Boolean)
  if (screenshotPaths.length < 1 || screenshotPaths.length > 5) {
    return { ok: false, reason: 'screenshot count out of range' }
  }
  for (const path of screenshotPaths) {
    if (!SCREENSHOT_PATH_RE.test(path)) {
      return { ok: false, reason: `invalid screenshot path: ${path}` }
    }
  }

  if (isGuest && !guestName) return { ok: false, reason: 'guest missing name' }
  if (!isGuest && !ordererId) return { ok: false, reason: 'auth missing orderer_id' }
  if (ordererId && !UUID_RE.test(ordererId)) {
    return { ok: false, reason: 'invalid orderer_id UUID' }
  }

  return { ok: true, schoolId, restaurantName: trimmed, subtotalCents, screenshotPaths }
}

/**
 * On Stripe Connect onboarding completion, marks stripe_accounts.onboarding_complete
 * and auto-activates is_swiper for users who already have a school_id.
 * @param account - The Stripe.Account object from the account.updated event
 * @param supabase - Service-role Supabase client
 * @called-by POST handler above
 */
async function handleAccountUpdated(
  account: Stripe.Account,
  supabase: ServiceClient
): Promise<void> {
  if (!account.details_submitted || !account.charges_enabled) return

  const { data: existing } = await supabase
    .from('stripe_accounts')
    .select('id, user_id')
    .eq('stripe_account_id', account.id)
    .maybeSingle()
  if (!existing) return

  console.log(`[webhook] account.updated: ${account.id}`)
  await supabase
    .from('stripe_accounts')
    .update({ onboarding_complete: true })
    .eq('stripe_account_id', account.id)

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', existing.user_id)
    .single()

  if (profile?.school_id) {
    await supabase
      .from('profiles')
      .update({ is_swiper: true })
      .eq('id', existing.user_id)
      .eq('is_swiper', false)
  } else {
    console.warn(
      `account.updated: skipping is_swiper activation for user ${existing.user_id} — no school_id set`
    )
  }
}
