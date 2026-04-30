/**
 * @file transfer.ts
 * @description Transfers funds from the platform to the swiper's Stripe connected account on order completion.
 *   Called by: app/api/orders/[id]/status/route.ts
 * @dependencies lib/stripe/client.ts, lib/supabase/service.ts
 */

import 'server-only'

import { getStripe } from './client'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Transfer funds from the platform to the swiper's connected Stripe account.
 *
 * Called when any order (guest or auth) reaches the 'completed' status.
 * Payment was captured upfront via Stripe Checkout. The transfer amount and
 * platform fee are read from the payment row so the realized split always
 * matches what was committed at checkout (single source of truth — no
 * recomputation drift).
 *
 * Idempotency: Stripe's idempotency key (`transfer-${orderId}`) prevents
 * double-charges. The DB payee_id write happens after the Stripe call
 * succeeds so a failed transfer doesn't block future retry attempts.
 */
export async function transferToSwiper(
  orderId: string,
  swiperId: string
) {
  const service = createServiceClient()

  const { data: payment } = await service
    .from('payments')
    .select('id, payee_id, amount_cents, platform_fee_cents, stripe_payment_intent_id')
    .eq('order_id', orderId)
    .eq('status', 'succeeded')
    .maybeSingle()

  if (!payment || payment.payee_id) {
    return
  }

  const { data: stripeAccount } = await service
    .from('stripe_accounts')
    .select('stripe_account_id')
    .eq('user_id', swiperId)
    .single()

  if (!stripeAccount) {
    console.error(`Transfer failed: no Stripe account for swiper ${swiperId}`)
    return
  }

  // Resolve the source charge so the transfer can debit pending settlement
  // funds (otherwise Stripe rejects with `balance_insufficient` while the
  // orderer's charge is still in the ~2-day settlement window).
  let chargeId: string | null = null
  try {
    const pi = await getStripe().paymentIntents.retrieve(
      payment.stripe_payment_intent_id
    )
    chargeId =
      typeof pi.latest_charge === 'string'
        ? pi.latest_charge
        : pi.latest_charge?.id ?? null
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Transfer failed for order ${orderId}: ${message}`)
    await service
      .from('payments')
      .update({ transfer_failed_at: new Date().toISOString() })
      .eq('order_id', orderId)
    return
  }

  if (!chargeId) {
    console.error(
      `Transfer failed for order ${orderId}: missing latest_charge on PaymentIntent ${payment.stripe_payment_intent_id}`
    )
    await service
      .from('payments')
      .update({ transfer_failed_at: new Date().toISOString() })
      .eq('order_id', orderId)
    return
  }

  const transferAmount = payment.amount_cents - payment.platform_fee_cents

  try {
    await getStripe().transfers.create(
      {
        amount: transferAmount,
        currency: 'usd',
        destination: stripeAccount.stripe_account_id,
        source_transaction: chargeId,
        metadata: { order_id: orderId },
      },
      { idempotencyKey: `transfer-${orderId}` }
    )
  } catch (err) {
    // Surface the failure on the payment row so ops can query for stuck
    // transfers; the order itself stays in 'completed' (Stripe holds the
    // platform balance until we retry or refund).
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Transfer failed for order ${orderId}: ${message}`)
    await service
      .from('payments')
      .update({ transfer_failed_at: new Date().toISOString() })
      .eq('order_id', orderId)
    return
  }

  // Mark payment as transferred. The atomic .is('payee_id', null) guards
  // against a duplicate transfer call racing with this update.
  await service
    .from('payments')
    .update({ payee_id: swiperId })
    .eq('order_id', orderId)
    .is('payee_id', null)
}
