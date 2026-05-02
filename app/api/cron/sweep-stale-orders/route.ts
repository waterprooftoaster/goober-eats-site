/**
 * @file route.ts
 * @description Vercel Cron endpoint that auto-cancels orders stuck in 'open'
 *   or 'in_progress' for more than 24 hours. Each stale order is canceled
 *   via stripe.paymentIntents.cancel (releases the auth hold) and flipped
 *   to status='cancelled'. Reuses the same code path as the orderer-cancel
 *   API in app/api/orders/[id]/status/route.ts. Auth: Authorization: Bearer
 *   ${CRON_SECRET}; Vercel Cron injects this when invoking the path
 *   configured in vercel.ts.
 *   Called by: Vercel Cron (every 15 min per vercel.ts)
 * @dependencies lib/stripe/client.ts, lib/supabase/service.ts, lib/api/helpers.ts
 */

import { NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getStripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/service'
import { apiError, apiSuccess } from '@/lib/api/helpers'

export const dynamic = 'force-dynamic'

const STALE_AGE_HOURS = 24

/**
 * Sweeps stale orders older than 24h and cancels them; releases each PI auth
 * via paymentIntents.cancel and flips orders.status='cancelled'.
 * @returns JSON { swept, failed } counts on success; 401 on missing/invalid auth.
 * @called-by Vercel Cron
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('CRON_SECRET is not set')
    return apiError('Server configuration error', 500)
  }

  if (!isValidCronAuth(request.headers.get('authorization'), cronSecret)) {
    return apiError('Unauthorized', 401)
  }

  const supabase = createServiceClient()
  const stripe = getStripe()
  const cutoff = new Date(Date.now() - STALE_AGE_HOURS * 60 * 60 * 1000).toISOString()

  const { data: stale, error } = await supabase
    .from('orders')
    .select('id, stripe_payment_intent_id')
    .in('status', ['open', 'in_progress'])
    .lt('created_at', cutoff)

  if (error) {
    console.error('sweep-stale-orders: query failed', error)
    return apiError('Query failed', 500)
  }

  const orders = (stale ?? []) as Array<{ id: string; stripe_payment_intent_id: string | null }>

  // Promise.allSettled so a single Stripe / DB failure doesn't block the batch.
  const results = await Promise.allSettled(orders.map((o) => cancelOne(o, stripe, supabase)))

  let swept = 0
  let failed = 0
  for (const r of results) {
    if (r.status === 'fulfilled') swept += 1
    else failed += 1
  }

  return apiSuccess({ swept, failed, total: orders.length })
}

// --- Helpers ---

type ServiceClient = ReturnType<typeof createServiceClient>
type StripeClient = ReturnType<typeof getStripe>

/**
 * Constant-time comparison of the Authorization header against the
 * configured CRON_SECRET; prevents byte-by-byte timing leaks.
 * @param header - Raw `Authorization` header value (or null)
 * @param secret - Expected CRON_SECRET
 * @returns true iff the header is exactly `Bearer ${secret}`
 * @called-by GET handler above
 */
function isValidCronAuth(header: string | null, secret: string): boolean {
  if (!header) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(header)
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

/**
 * Cancels a single stale order: paymentIntents.cancel + orders.update +
 * (if conversation exists) post a system message announcing the auto-cancel.
 * Skips cancellation entirely (no DB mutation) when the linked payment row
 * is already settled (succeeded/refunded) — those orders need ops review,
 * not a force-flip to cancelled which would leave the orderer charged.
 * @param order - Stale order id + PI id (PI may be null for legacy/test data)
 * @param stripe - Stripe client
 * @param supabase - Service-role Supabase client
 * @returns Resolves on success; rejects on first DB / Stripe failure (caller wraps in allSettled)
 * @called-by GET handler above
 */
async function cancelOne(
  order: { id: string; stripe_payment_intent_id: string | null },
  stripe: StripeClient,
  supabase: ServiceClient
): Promise<void> {
  if (order.stripe_payment_intent_id) {
    // Defense against a captured-then-stale race: if capture/transfer ran
    // (manual-capture flow) but the order's status flip lagged, the PI is
    // already settled. Cancelling would error AND leave the orderer charged.
    const { data: payment } = await supabase
      .from('payments')
      .select('status')
      .eq('order_id', order.id)
      .maybeSingle()

    if (payment?.status === 'succeeded' || payment?.status === 'refunded') {
      console.error(
        `sweep: order ${order.id} has settled payment (${payment.status}); skipping cancel — needs manual review`
      )
      return
    }

    try {
      await stripe.paymentIntents.cancel(
        order.stripe_payment_intent_id,
        undefined,
        { idempotencyKey: `cancel-${order.id}` }
      )
    } catch (err) {
      // PI already canceled is a soft failure: still flip status (auth-only,
      // never captured — confirmed by the payment-status guard above).
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`sweep: cancel failed for order ${order.id} (PI ${order.stripe_payment_intent_id}): ${message}`)
    }
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', order.id)

  if (updateError) {
    throw new Error(`orders.update failed for ${order.id}: ${updateError.message}`)
  }

  // Best-effort system message into the conversation (if one exists).
  // Fire-and-forget: failures here are noise, not load-bearing.
  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('order_id', order.id)
    .maybeSingle()

  if (conv) {
    await supabase.from('messages').insert({
      conversation_id: conv.id,
      sender_id: null,
      message_type: 'system',
      body: 'Order auto-cancelled after 24 hours.',
    })
  }
}
