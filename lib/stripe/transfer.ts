/**
 * @file transfer.ts
 * @description Transfers funds from the platform to the swiper's Stripe
 *   connected account on order completion. Checkout keeps funds on the
 *   platform (no `transfer_data.destination` — swiper is unknown at
 *   checkout time), so this is where the 10% platform fee is applied and
 *   the remainder routed to the swiper.
 *
 *   On Stripe failure a row is inserted into `transfer_failures` instead
 *   of the prior silent console.error; ops can query the unresolved-
 *   failures index to retry. The historical `UPDATE orders SET status='paid'`
 *   was removed because `'paid'` was dropped from the order_status enum
 *   in migration 20260329000000; 'completed' is the terminal state.
 *   Called by: app/api/orders/[id]/status/route.ts
 * @dependencies lib/stripe/client.ts, lib/supabase/service.ts, lib/pricing.ts
 */

import 'server-only'

import { getStripe } from './client'
import { createServiceClient } from '@/lib/supabase/service'
import { platformFeeCents } from '@/lib/pricing'

/**
 * Transfers the order amount minus the 10% platform fee to the swiper's
 *   Stripe Connect account; records a row in `transfer_failures` on error.
 * @param orderId - The completed order's UUID
 * @param swiperId - The swiper profile.id the transfer should reach
 * @param totalCents - Orderer-paid total in cents; fee is 10% of this
 * @called-by app/api/orders/[id]/status/route.ts (completion branch)
 */
export async function transferToSwiper(
  orderId: string,
  swiperId: string,
  totalCents: number
): Promise<void> {
  const service = createServiceClient()

  // Skip if already transferred (payee_id set on a succeeded payment).
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
    await service.from('transfer_failures').insert({
      order_id: orderId,
      stripe_error_code: 'no_connected_account',
      stripe_error_message: `Swiper ${swiperId} has no Stripe connected account`,
    })
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
    const code = extractStripeCode(err)
    const message = err instanceof Error ? err.message : 'Unknown error'

    // TODO(ops): wire a pager/alerting hook here so unresolved transfer
    // failures surface beyond the DB. The partial index on
    // transfer_failures.resolved_at IS NULL supports the dashboard query.
    await service.from('transfer_failures').insert({
      order_id: orderId,
      stripe_error_code: code,
      stripe_error_message: message,
    })
    return
  }

  // Only mark transferred after the Stripe call succeeds. Leaves
  // orders.status at 'completed' (terminal per migration 20260329000000).
  await service
    .from('payments')
    .update({ payee_id: swiperId })
    .eq('order_id', orderId)
    .is('payee_id', null)
}

// --- Helpers ---

/**
 * Narrows an unknown thrown value into the Stripe `code` string when present.
 * @param err - Anything caught from `transfers.create`
 * @returns The Stripe error code (e.g. 'balance_insufficient') or null
 */
function extractStripeCode(err: unknown): string | null {
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    return err.code
  }
  return null
}
