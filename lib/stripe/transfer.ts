/**
 * @file transfer.ts
 * @description Transfers funds from the platform to the swiper's Stripe connected account on order completion.
 *   Called by: app/api/orders/[id]/status/route.ts
 * @dependencies lib/stripe/client.ts, lib/supabase/service.ts, lib/pricing.ts
 */

import 'server-only'

import { getStripe } from './client'
import { createServiceClient } from '@/lib/supabase/service'
import { platformFeeCents } from '@/lib/pricing'

/**
 * Transfer funds from the platform to the swiper's connected Stripe account.
 *
 * Called when any order (guest or auth) reaches the 'completed' status.
 * Payment was captured upfront via Stripe Checkout.
 *
 * Idempotency: Stripe's idempotency key (`transfer-${orderId}`) prevents
 * double-charges. The DB payee_id write happens after the Stripe call
 * succeeds so a failed transfer doesn't block future retry attempts.
 */
export async function transferToSwiper(
  orderId: string,
  swiperId: string,
  totalCents: number
) {
  const service = createServiceClient()

  // Check if transfer already completed (payee_id already set)
  const { data: payment } = await service
    .from('payments')
    .select('id, payee_id')
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

  const fee = platformFeeCents(totalCents)
  const transferAmount = totalCents - fee

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
    return
  }

  // Mark payment as transferred and advance order to 'paid'
  await service
    .from('payments')
    .update({ payee_id: swiperId })
    .eq('order_id', orderId)
    .is('payee_id', null)

  const { error: statusError } = await service
    .from('orders')
    .update({ status: 'paid' })
    .eq('id', orderId)
    .eq('status', 'completed')

  if (statusError) {
    console.error(`Transfer succeeded but failed to update order ${orderId} to paid: ${statusError.message}`)
  }
}
