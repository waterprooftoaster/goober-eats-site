/**
 * @file route.ts
 * @description Stripe webhook handler. Verifies the event signature,
 *   records every event in `stripe_events` for replay dedup, then
 *   dispatches to per-event handlers.
 *
 *   Handled events:
 *     - payment_intent.succeeded    — creates order + payment row
 *     - payment_intent.payment_failed — no-op
 *     - checkout.session.completed  — no-op (order creation via PI)
 *     - checkout.session.expired    — no-op
 *     - account.updated             — persists Stripe Connect state; downgrades
 *                                     onboarding_complete when charges are disabled
 *     - charge.dispute.created      — marks payments.status = 'disputed'
 *     - charge.dispute.closed       — won → 'succeeded'; lost → records note
 *                                     when funds already transferred
 *     - charge.refunded             — marks payments.status = 'refunded'
 *
 *   Idempotency: stripe_events has a UNIQUE constraint on event.id; the
 *   `recordEvent` helper short-circuits on replay.
 *   Called by: Stripe webhook delivery (not directly by app code)
 * @dependencies lib/stripe/client.ts, lib/supabase/service.ts, lib/api/helpers.ts,
 *               lib/stripe/webhook-idempotency.ts, lib/stripe/account-state.ts,
 *               lib/pricing.ts
 */

import { NextRequest } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/service'
import { apiError, apiSuccess } from '@/lib/api/helpers'
import { recordEvent } from '@/lib/stripe/webhook-idempotency'
import { fromStripeAccount } from '@/lib/stripe/account-state'
import { platformFeeCents } from '@/lib/pricing'
import type Stripe from 'stripe'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SCREENSHOT_PATH_RE =
  /^pre-checkout\/[A-Za-z0-9_-]{10}\/[0-9a-fA-F-]{36}\.(?:png|jpg|jpeg|webp|heic|heif)$/

export const dynamic = 'force-dynamic'

/**
 * Handles Stripe webhook events with signature verification and idempotency.
 * @returns JSON on success; 400/500 on signature validation or processing errors
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

  // SIGNATURE VERIFICATION FIRST — never touch the DB on untrusted input.
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    console.warn('webhook: invalid signature — check STRIPE_WEBHOOK_SECRET matches stripe listen output')
    return apiError('Invalid webhook signature', 400)
  }

  const supabase = createServiceClient()

  // Idempotency AFTER signature — writes to stripe_events so malformed
  // payloads can't pollute the dedup table.
  let duplicate = false
  try {
    const result = await recordEvent(event.id, event.type, supabase)
    duplicate = result.isDuplicate
  } catch (err) {
    console.error('webhook: failed to record event for idempotency', { eventId: event.id, err })
    return apiError('Failed to process webhook', 500)
  }

  if (duplicate) {
    return apiSuccess({ received: true, duplicate: true })
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent
      const result = await handlePaymentIntentSucceeded(pi, supabase)
      if (result) return result
      break
    }

    case 'payment_intent.payment_failed': {
      break
    }

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      console.log(`checkout.session.completed: session ${session.id} (no-op)`)
      break
    }

    case 'checkout.session.expired': {
      break
    }

    case 'account.updated': {
      const account = event.data.object as Stripe.Account
      await handleAccountUpdated(account, supabase)
      break
    }

    case 'charge.dispute.created': {
      const dispute = event.data.object as Stripe.Dispute
      await handleDisputeCreated(dispute, supabase)
      break
    }

    case 'charge.dispute.closed': {
      const dispute = event.data.object as Stripe.Dispute
      await handleDisputeClosed(dispute, supabase)
      break
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      await handleChargeRefunded(charge, supabase)
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
  const guestName = isGuest ? (meta.guest_name ?? '').slice(0, 100) || null : null
  const ordererId = isGuest ? null : meta.orderer_id

  const validation = validatePaymentIntentMetadata(meta, isGuest, guestName, ordererId)
  if (!validation.ok) {
    console.warn(`payment_intent.succeeded: skip — ${validation.reason}`, { piId: pi.id })
    return null
  }
  const { schoolId, restaurantName, totalCents, screenshotPaths } = validation

  // Row-level idempotency: skip if payment already recorded for this PI.
  // (Complements the event-level guard in stripe_events; needed because a
  // brand-new event_id can still refer to a PI we've already persisted
  // from a prior delivery cycle.)
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

  const feeCents = platformFeeCents(totalCents)

  let orderId: string
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      orderer_id: ordererId,
      school_id: schoolId,
      restaurant_name: restaurantName,
      cart_screenshot_urls: screenshotPaths,
      stripe_payment_intent_id: pi.id,
      total_cents: totalCents,
      guest_name: guestName,
      guest_phone: null,
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
    amount_cents: totalCents,
    platform_fee_cents: feeCents,
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
  totalCents: number
  screenshotPaths: string[]
}

type MetadataErr = { ok: false; reason: string }

/**
 * Validates the Stripe metadata required to create an order.
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
  const totalCentsRaw = meta.total_cents
  const screenshotPathsRaw = meta.cart_screenshot_paths

  if (!schoolId) return { ok: false, reason: 'missing school_id' }
  if (!UUID_RE.test(schoolId)) return { ok: false, reason: 'invalid school_id UUID' }
  if (!restaurantName) return { ok: false, reason: 'missing restaurant_name' }
  const trimmed = restaurantName.trim()
  if (trimmed.length < 1 || trimmed.length > 80) {
    return { ok: false, reason: 'restaurant_name length out of range' }
  }
  if (!totalCentsRaw) return { ok: false, reason: 'missing total_cents' }
  const totalCents = parseInt(totalCentsRaw, 10)
  if (!Number.isInteger(totalCents) || totalCents < 50 || totalCents > 50_000) {
    return { ok: false, reason: 'invalid total_cents' }
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

  return { ok: true, schoolId, restaurantName: trimmed, totalCents, screenshotPaths }
}

/**
 * Persists the full Stripe Connect state onto stripe_accounts. Downgrades
 *   onboarding_complete whenever charges stop working; auto-activates
 *   is_swiper when onboarding has just crossed the threshold.
 * @param account - Stripe.Account from the account.updated event
 * @param supabase - Service-role Supabase client
 * @called-by POST handler above
 */
async function handleAccountUpdated(
  account: Stripe.Account,
  supabase: ServiceClient
): Promise<void> {
  const { data: existing } = await supabase
    .from('stripe_accounts')
    .select('id, user_id, onboarding_complete')
    .eq('stripe_account_id', account.id)
    .maybeSingle()
  if (!existing) return

  const state = fromStripeAccount(account)

  const { error: updateError } = await supabase
    .from('stripe_accounts')
    .update({
      onboarding_complete: state.onboardingComplete,
      charges_enabled: state.chargesEnabled,
      payouts_enabled: state.payoutsEnabled,
      disabled_reason: state.disabledReason,
      currently_due: state.currentlyDue,
    })
    .eq('stripe_account_id', account.id)

  if (updateError) {
    // Surface the error so Stripe retries the webhook rather than leaving
    // stale DB state when the UPDATE silently drops (row locked, etc.).
    console.error('account.updated: failed to persist Connect state', {
      accountId: account.id,
      error: updateError,
    })
    throw updateError
  }

  // Only auto-activate is_swiper when onboarding crosses from false → true.
  // This preserves the prior one-shot activation and avoids fighting the
  // user if they manually toggled is_swiper.
  const becameActive =
    !existing.onboarding_complete && state.onboardingComplete

  if (becameActive) {
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
}

/**
 * Marks the payment row disputed when Stripe opens a chargeback.
 * @param dispute - Stripe.Dispute from the charge.dispute.created event
 * @param supabase - Service-role Supabase client
 * @called-by POST handler above
 */
async function handleDisputeCreated(
  dispute: Stripe.Dispute,
  supabase: ServiceClient
): Promise<void> {
  const paymentIntentId = resolvePaymentIntentId(dispute.payment_intent)
  if (!paymentIntentId) {
    console.warn('charge.dispute.created: no payment_intent on dispute', { disputeId: dispute.id })
    return
  }

  const { error } = await supabase
    .from('payments')
    .update({ status: 'disputed' })
    .eq('stripe_payment_intent_id', paymentIntentId)

  if (error) {
    console.error('charge.dispute.created: failed to mark payment disputed', {
      disputeId: dispute.id,
      paymentIntentId,
      error,
    })
  }
}

/**
 * Closes a dispute: won → payments.status = 'succeeded'; lost → records a
 *   transfer_failures row when funds had already transferred to the swiper.
 * @param dispute - Stripe.Dispute from the charge.dispute.closed event
 * @param supabase - Service-role Supabase client
 * @called-by POST handler above
 */
async function handleDisputeClosed(
  dispute: Stripe.Dispute,
  supabase: ServiceClient
): Promise<void> {
  const paymentIntentId = resolvePaymentIntentId(dispute.payment_intent)
  if (!paymentIntentId) {
    console.warn('charge.dispute.closed: no payment_intent on dispute', { disputeId: dispute.id })
    return
  }

  if (dispute.status === 'won') {
    // Only un-flag payments still marked disputed; avoids overwriting a
    // concurrent state change (e.g. a manual refund that landed first).
    await supabase
      .from('payments')
      .update({ status: 'succeeded' })
      .eq('stripe_payment_intent_id', paymentIntentId)
      .eq('status', 'disputed')
    return
  }

  if (dispute.status === 'lost') {
    const { data: payment } = await supabase
      .from('payments')
      .select('order_id, payee_id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle()

    if (payment?.payee_id) {
      // Funds already transferred to the swiper. Auto-reversal is out of
      // scope per the original prompt; persist a marker row so ops can
      // reconcile manually.
      await supabase.from('transfer_failures').insert({
        order_id: payment.order_id,
        stripe_error_code: 'dispute-lost-post-transfer',
        stripe_error_message: `Dispute ${dispute.id} was lost; funds already transferred to swiper.`,
      })
    }
    return
  }

  // warning_* / needs_response / under_review: no action.
}

/**
 * Marks the payment refunded when Stripe records a full refund on the charge.
 * @param charge - Stripe.Charge from the charge.refunded event
 * @param supabase - Service-role Supabase client
 * @called-by POST handler above
 */
async function handleChargeRefunded(
  charge: Stripe.Charge,
  supabase: ServiceClient
): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null
  if (!paymentIntentId) return

  // Idempotent with the cancel-refund flow: if the payment is already
  // marked refunded, this UPDATE is a no-op.
  await supabase
    .from('payments')
    .update({ status: 'refunded' })
    .eq('stripe_payment_intent_id', paymentIntentId)
}

/**
 * Narrows `dispute.payment_intent` (string | PaymentIntent | null) to the id.
 * @param pi - The payment_intent field from the dispute object
 * @returns The payment intent id or null
 */
function resolvePaymentIntentId(
  pi: string | Stripe.PaymentIntent | null | undefined
): string | null {
  if (!pi) return null
  return typeof pi === 'string' ? pi : pi.id
}
