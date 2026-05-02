/**
 * @file route.ts
 * @description Stripe webhook handler. After the manual-capture switch:
 *   - payment_intent.amount_capturable_updated creates the order + payments
 *     row (status='pending') from the metadata embedded by
 *     /api/stripe/checkout-session. This is the "card authorized" event.
 *   - payment_intent.succeeded fires AFTER capture (orderer was charged when
 *     swiper completed) and flips payments.status from 'pending' to 'succeeded'.
 *   - payment_intent.canceled fires when the auth hold is released (orderer
 *     cancel, 24h sweep, or Stripe-side expiry) and mirrors to orders.status
 *     = 'cancelled'.
 *   The 40/30/10 split is re-derived server-side via lib/pricing.ts:computeSplit
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
import { CART_TOTAL_MAX_CENTS } from '@/lib/constants'
import { sendOrderPlacedEmail, sendNewOrderToSwipers } from '@/lib/email/send'
import type Stripe from 'stripe'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SCREENSHOT_PATH_RE =
  /^pre-checkout\/[A-Za-z0-9_-]{10}\/[0-9a-fA-F-]{36}\.(?:png|jpg|jpeg|webp|heic|heif)$/

export const dynamic = 'force-dynamic'

/**
 * Handles Stripe webhook events for the manual-capture flow plus Stripe Connect onboarding.
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

  const supabase = createServiceClient()

  switch (event.type) {
    case 'payment_intent.amount_capturable_updated': {
      // Card authorized — create order + payments row (status='pending').
      const pi = event.data.object as Stripe.PaymentIntent
      const result = await handlePaymentIntentAmountCapturable(pi, supabase)
      if (result) return result
      break
    }

    case 'payment_intent.succeeded': {
      // Funds captured (after swiper completed). Flip payments row to 'succeeded'.
      const pi = event.data.object as Stripe.PaymentIntent
      const result = await handlePaymentIntentCaptured(pi, supabase)
      if (result) return result
      break
    }

    case 'payment_intent.canceled': {
      // Auth hold released (orderer cancel, 24h sweep, or expiry). Mirror to order.
      const pi = event.data.object as Stripe.PaymentIntent
      const result = await handlePaymentIntentCanceled(pi, supabase)
      if (result) return result
      break
    }

    case 'payment_intent.payment_failed': {
      // No-op for checkout flow: no order exists in our DB until amount_capturable_updated fires.
      break
    }

    case 'checkout.session.completed': {
      // No-op: order creation is driven by payment_intent.amount_capturable_updated.
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
 * Validates and persists an order + payment when funds become capturable
 * (card authorized but not yet captured under manual-capture).
 * @param pi - The Stripe PaymentIntent in requires_capture state
 * @param supabase - Service-role Supabase client (bypasses RLS for inserts)
 * @returns A NextResponse error to short-circuit the webhook (signal Stripe to retry), or null on success/no-op
 * @called-by POST handler above
 */
async function handlePaymentIntentAmountCapturable(
  pi: Stripe.PaymentIntent,
  supabase: ServiceClient
): Promise<Response | null> {
  const meta = pi.metadata
  const isGuest = meta.is_guest === 'true'
  // Cap guest_name to the same 100-char ceiling as the request schema to
  // defend against metadata tampering by a compromised platform key.
  const guestName = isGuest ? (meta.guest_name ?? '').slice(0, 100) || null : null
  const ordererId = isGuest ? null : meta.orderer_id

  const validation = validatePaymentIntentMetadata(meta, isGuest, guestName, ordererId)
  if (!validation.ok) {
    console.warn(`payment_intent.amount_capturable_updated: skip — ${validation.reason}`, { piId: pi.id })
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
    console.error('payment_intent.amount_capturable_updated: idempotency check failed', {
      piId: pi.id,
      error: paymentCheckError,
    })
    return apiError('Failed to check payment', 500)
  }

  if (existingPayment) {
    // Stripe re-delivered an event we've already processed; idempotent ack.
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
      console.error('payment_intent.amount_capturable_updated: failed to create order', orderError)
      // Permanent constraint violation: Stripe retrying won't fix a row our
      // schema would reject again. Ack with 200 so Stripe drops the event;
      // the failure is logged for ops follow-up. Anything else (network,
      // transient unavailability, unknown) is retryable → 500.
      return isPermanentDbError(orderError) ? null : apiError('Failed to create order', 500)
    }
    orderId = existing.id
  } else {
    orderId = order.id
  }

  // payments.status='pending' — funds authorized, not yet captured.
  // The capture event (payment_intent.succeeded) flips this to 'succeeded'.
  const { error: paymentError } = await supabase.from('payments').insert({
    order_id: orderId,
    stripe_payment_intent_id: pi.id,
    amount_cents: split.ordererPaysCents,
    platform_fee_cents: split.platformFeeCents,
    status: 'pending',
    payer_id: ordererId,
    payee_id: null,
  })

  if (paymentError) {
    console.error('payment_intent.amount_capturable_updated: failed to record payment', paymentError)
    return isPermanentDbError(paymentError) ? null : apiError('Failed to record payment', 500)
  }

  void sendOrderPlacedEmail({
    ordererId,
    isGuest,
    guestName,
    pi,
    restaurantName,
    totalCents: split.ordererPaysCents,
    orderId,
  })
  void sendNewOrderToSwipers({ schoolId, restaurantName })

  return null
}

/**
 * Flips the payments row for this PI from 'pending' to 'succeeded' after
 * Stripe captures funds. Idempotent: re-delivery just re-issues the same
 * UPDATE, which is a no-op against an already-succeeded row.
 * @param pi - The Stripe PaymentIntent that was captured
 * @param supabase - Service-role Supabase client
 * @returns Error response on DB failure (Stripe retries), null on success/no-op
 * @called-by POST handler above
 */
async function handlePaymentIntentCaptured(
  pi: Stripe.PaymentIntent,
  supabase: ServiceClient
): Promise<Response | null> {
  const { error } = await supabase
    .from('payments')
    .update({ status: 'succeeded' })
    .eq('stripe_payment_intent_id', pi.id)

  if (error) {
    console.error('payment_intent.succeeded: failed to mark payment captured', { piId: pi.id, error })
    return isPermanentDbError(error) ? null : apiError('Failed to mark payment captured', 500)
  }
  return null
}

/**
 * Mirrors a Stripe PI cancellation to orders.status='cancelled'. Fires when
 * the auth hold is released — orderer cancel, 24h sweep, or expiry.
 * Idempotent: re-delivery against an already-cancelled order is a no-op.
 * @param pi - The Stripe PaymentIntent that was canceled
 * @param supabase - Service-role Supabase client
 * @returns Error response on DB failure (Stripe retries), null on success/no-op
 * @called-by POST handler above
 */
async function handlePaymentIntentCanceled(
  pi: Stripe.PaymentIntent,
  supabase: ServiceClient
): Promise<Response | null> {
  // Zero-row UPDATE is the deliberate no-op when cancel arrives before the
  // matching order is created (e.g. user abandoned checkout before card auth,
  // or amount_capturable_updated never fired). Supabase does not error on a
  // zero-row UPDATE, so this safely acks Stripe with no DB mutation.
  const { error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('stripe_payment_intent_id', pi.id)

  if (error) {
    console.error('payment_intent.canceled: failed to flip order to cancelled', { piId: pi.id, error })
    return isPermanentDbError(error) ? null : apiError('Failed to update order', 500)
  }
  return null
}

/**
 * Postgres error codes that signal a permanent failure: retrying with the
 * same payload will fail again. We ack these with 200 so Stripe stops
 * retrying; anything else falls through to 500 for transient retries.
 * @param err - Supabase error object (has a `code` field for Postgres errors)
 * @returns true when the error is permanent and should not be retried
 */
function isPermanentDbError(err: { code?: string } | null): boolean {
  if (!err?.code) return false
  // 23xxx = integrity-constraint violations (NOT NULL, CHECK, FK, unique).
  // 22xxx = data-exception (invalid input format, value out of range).
  return err.code.startsWith('23') || err.code.startsWith('22')
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
 * @called-by handlePaymentIntentAmountCapturable
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
  if (!Number.isInteger(subtotalCents) || subtotalCents < 50 || subtotalCents > CART_TOTAL_MAX_CENTS) {
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
 * Pulls every in_progress order assigned to this swiper back to 'open' with
 * swiper_id=null, detaches conversations, and posts a system message into
 * each conversation. Mirrors the un-accept side-effect in
 * app/api/orders/[id]/status/route.ts but driven from the webhook side
 * because the swiper has been terminated and can no longer act.
 * @param userId - The swiper's user_id (from stripe_accounts.user_id)
 * @param supabase - Service-role Supabase client
 * @called-by handleAccountUpdated (rejection branch)
 */
async function unacceptInflightOrders(
  userId: string,
  supabase: ServiceClient
): Promise<void> {
  const { data: orders } = await supabase
    .from('orders')
    .update({ status: 'open', swiper_id: null })
    .eq('swiper_id', userId)
    .eq('status', 'in_progress')
    .select('id')

  if (!orders || orders.length === 0) return
  const orderIds = (orders as Array<{ id: string }>).map((o) => o.id)

  // Detach conversations (mirrors the un-accept side-effect at
  // app/api/orders/[id]/status/route.ts:137-142). Without this, the prior
  // swiper retains conversation RLS access to messages.
  await supabase
    .from('conversations')
    .update({ swiper_id: null, swiper_assigned_at: null })
    .in('order_id', orderIds)

  // Look up conversation ids to post a system message into each.
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, order_id')
    .in('order_id', orderIds)

  if (!convs || convs.length === 0) return
  const messageRows = (convs as Array<{ id: string; order_id: string }>).map((c) => ({
    conversation_id: c.id,
    sender_id: null,
    message_type: 'system',
    body: 'Your swiper became unavailable. Order returned to queue.',
  }))
  await supabase.from('messages').insert(messageRows)
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
  // Locate the row first — we want to handle suspension even when
  // details_submitted/charges_enabled are false (Stripe disables them when it
  // rejects an account).
  const { data: existing } = await supabase
    .from('stripe_accounts')
    .select('id, user_id')
    .eq('stripe_account_id', account.id)
    .maybeSingle()
  if (!existing) return

  // Permanent termination: Stripe sets requirements.disabled_reason to a value
  // starting with 'rejected.' (rejected.fraud, rejected.terms_of_service,
  // rejected.listed, rejected.other, rejected.platform_paused). At that point
  // we have zero liability — Stripe has formally terminated the account — so
  // we suspend ours and force-logout via the gates in helpers.ts /
  // actions.ts / resolve-principal.ts. Other disabled_reason values
  // (requirements.past_due, pending_verification, under_review) are temporary
  // and do NOT trigger suspension.
  const disabledReason = account.requirements?.disabled_reason ?? null
  if (disabledReason && disabledReason.startsWith('rejected.')) {
    // Order matters: SUSPEND FIRST so any concurrent /api/orders/[id]/accept
    // call from this swiper fails the suspended re-check before claiming.
    // Unaccept second to return their in-flight orders to the queue. If we
    // crash between, the suspension flag is already in place; the redelivery
    // (Stripe re-fires on non-2xx) re-runs the unaccept idempotently.
    await supabase
      .from('stripe_accounts')
      .update({ suspended: true })
      .eq('stripe_account_id', account.id)

    await unacceptInflightOrders(existing.user_id, supabase)
    return
  }

  // Onboarding completion path — only when Stripe reports the account is fully
  // ready to charge.
  if (!account.details_submitted || !account.charges_enabled) return

  // Mark onboarding complete and read the user's school_id concurrently —
  // they don't depend on each other.
  const [, profileRead] = await Promise.all([
    supabase
      .from('stripe_accounts')
      .update({ onboarding_complete: true })
      .eq('stripe_account_id', account.id),
    supabase
      .from('profiles')
      .select('school_id')
      .eq('id', existing.user_id)
      .single(),
  ])

  const profile = profileRead.data
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
