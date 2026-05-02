/**
 * @file refund.ts
 * @description Issues a Stripe refund for a completed order's PaymentIntent.
 *   Called from the complaint API route when the AI adjudicator returns
 *   `approve_refund`. Refund amount === payments.amount_cents (what the
 *   orderer was actually charged), NOT orders.subtotal_cents (which is the
 *   cart-screenshot subtotal, not the charged amount).
 *
 *   Idempotency: the caller passes a per-complaint key (e.g.
 *   `complaint-refund-${complaintId}`) so retries on the same complaint are
 *   safe; a fresh complaint on the same order is impossible because of the
 *   one-per-order UNIQUE constraint.
 *
 *   On success the payment row is flipped to status='refunded' so the schema
 *   payment_status enum stays accurate. Throws on any non-success path —
 *   the route layer catches and persists the verdict as pending so an op
 *   can investigate.
 *   Called by: app/api/orders/[id]/complaints/route.ts
 * @dependencies lib/stripe/client.ts, lib/supabase/service.ts
 */

import 'server-only'

import { getStripe } from './client'
import { createServiceClient } from '@/lib/supabase/service'

export interface RefundResult {
  refundId: string
  amountCents: number
}

/**
 * Refunds the full charged amount on the order's PaymentIntent.
 * @param orderId - UUID of the order being refunded
 * @param idempotencyKey - Unique key per refund attempt; pass the complaint id (or similar)
 * @returns Stripe refund id and the cents refunded
 * @throws Error when the payment is missing, already refunded, or Stripe rejects the call
 * @called-by app/api/orders/[id]/complaints/route.ts
 */
export async function refundOrder(
  orderId: string,
  idempotencyKey: string
): Promise<RefundResult> {
  const service = createServiceClient()

  const { data: payment } = await service
    .from('payments')
    .select('id, amount_cents, status, stripe_payment_intent_id')
    .eq('order_id', orderId)
    .maybeSingle()

  if (!payment) {
    throw new Error(`refundOrder: no payment row for order ${orderId}`)
  }
  if (payment.status === 'refunded') {
    throw new Error(`refundOrder: order ${orderId} already refunded`)
  }
  if (payment.status !== 'succeeded') {
    throw new Error(
      `refundOrder: order ${orderId} not refundable (payment status=${payment.status})`
    )
  }

  const refund = await getStripe().refunds.create(
    {
      payment_intent: payment.stripe_payment_intent_id,
      amount: payment.amount_cents,
      metadata: { order_id: orderId },
    },
    { idempotencyKey }
  )

  await service
    .from('payments')
    .update({ status: 'refunded' })
    .eq('order_id', orderId)

  return { refundId: refund.id, amountCents: payment.amount_cents }
}
