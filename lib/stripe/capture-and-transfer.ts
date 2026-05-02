/**
 * @file capture-and-transfer.ts
 * @description Captures the orderer's authorized PaymentIntent and transfers
 *   the net to the swiper's connected account on order completion. Under
 *   manual-capture (see app/api/stripe/checkout-session/route.ts), funds are
 *   only authorized at checkout; capture happens HERE when the swiper completes.
 *   Capture failure blocks completion (caller responds 409 and rolls back
 *   the order status). Transfer failure does NOT block completion — the food
 *   was delivered, the orderer was charged; ops resolve stuck transfers via
 *   payments.transfer_failed_at.
 *
 *   Replaces lib/stripe/transfer.ts (which assumed funds were already captured
 *   at checkout).
 *   Called by: app/api/orders/[id]/status/route.ts
 * @dependencies lib/stripe/client.ts, lib/supabase/service.ts
 */

import 'server-only'

import { getStripe } from './client'
import { createServiceClient } from '@/lib/supabase/service'

export type CaptureAndTransferResult =
  | { ok: true; transferStuck?: boolean }
  | { ok: false; reason: 'capture_failed' | 'no_payment' }

/**
 * Captures the orderer's authorized PI and transfers the net to the swiper.
 * Idempotent via Stripe idempotency keys (`capture-${orderId}`,
 * `transfer-${orderId}`); safe to retry. Capture and transfer are independent:
 * capture failure aborts and signals the caller to keep the order at
 * in_progress; transfer failure marks transfer_failed_at and returns
 * transferStuck=true so the caller still completes the order.
 *
 * @param orderId - Order being completed
 * @param swiperId - Swiper to receive the transfer
 * @returns Discriminated result. ok=false → caller responds 409 (status stays in_progress).
 *   ok=true → caller marks order completed; transferStuck=true means money is on the platform
 *   balance for ops follow-up.
 * @called-by app/api/orders/[id]/status/route.ts (completion branch)
 */
export async function captureAndTransfer(
  orderId: string,
  swiperId: string
): Promise<CaptureAndTransferResult> {
  const service = createServiceClient()

  const { data: payment } = await service
    .from('payments')
    .select('id, status, payee_id, amount_cents, platform_fee_cents, stripe_payment_intent_id')
    .eq('order_id', orderId)
    .maybeSingle()

  if (!payment || !payment.stripe_payment_intent_id) {
    console.error(`captureAndTransfer: no payment row for order ${orderId}`)
    return { ok: false, reason: 'no_payment' }
  }

  // Three legal payment.status values reach this point:
  //   'pending'   — auth-only, capture has not run yet → run capture now
  //   'succeeded' — a prior call (or the webhook) already captured → skip to transfer
  //   'refunded'  — should not be possible (order completion implies no prior refund)
  // Anything else (e.g., a hypothetical 'failed' ever added to the enum) is a
  // programming error: bail rather than silently re-capturing.
  if (payment.status !== 'pending' && payment.status !== 'succeeded') {
    console.error(
      `captureAndTransfer: unexpected payment.status='${payment.status}' for order ${orderId}; refusing to capture`
    )
    return { ok: false, reason: 'capture_failed' }
  }

  if (payment.status === 'pending') {
    try {
      await getStripe().paymentIntents.capture(
        payment.stripe_payment_intent_id,
        {},
        { idempotencyKey: `capture-${orderId}` }
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`Capture failed for order ${orderId}: ${message}`)
      await service
        .from('payments')
        .update({ capture_failed_at: new Date().toISOString() })
        .eq('id', payment.id)
      return { ok: false, reason: 'capture_failed' }
    }

    // Capture succeeded: flip payments.status to 'succeeded'. The webhook
    // for payment_intent.succeeded also flips this (idempotent), but updating
    // locally avoids a race where downstream readers see stale 'pending'.
    await service
      .from('payments')
      .update({ status: 'succeeded' })
      .eq('id', payment.id)
  }

  // Transfer step. Skip if already transferred (idempotent retry).
  if (payment.payee_id) {
    return { ok: true }
  }

  const { data: stripeAccount } = await service
    .from('stripe_accounts')
    .select('stripe_account_id')
    .eq('user_id', swiperId)
    .single()

  if (!stripeAccount) {
    // Capture has succeeded; refusing to mark the order completed would leave
    // funds captured with no order completion. Mark transferStuck so the
    // caller still completes; ops resolves the orphan transfer manually.
    console.error(`captureAndTransfer: no Stripe account for swiper ${swiperId} after capture; marking transfer stuck`)
    await service
      .from('payments')
      .update({ transfer_failed_at: new Date().toISOString() })
      .eq('id', payment.id)
    return { ok: true, transferStuck: true }
  }

  const transferAmount = payment.amount_cents - payment.platform_fee_cents

  try {
    await getStripe().transfers.create(
      {
        amount: transferAmount,
        currency: 'usd',
        destination: stripeAccount.stripe_account_id,
        metadata: { order_id: orderId },
      },
      { idempotencyKey: `transfer-${orderId}` }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Transfer failed for order ${orderId}: ${message}`)
    await service
      .from('payments')
      .update({ transfer_failed_at: new Date().toISOString() })
      .eq('id', payment.id)
    return { ok: true, transferStuck: true }
  }

  // Mark transfer succeeded. The atomic .is('payee_id', null) guards against
  // a duplicate transfer call racing with this update.
  await service
    .from('payments')
    .update({ payee_id: swiperId })
    .eq('id', payment.id)
    .is('payee_id', null)

  return { ok: true }
}
