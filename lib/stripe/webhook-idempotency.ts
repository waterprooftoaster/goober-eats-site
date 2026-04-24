/**
 * @file webhook-idempotency.ts
 * @description Records every Stripe webhook event in `stripe_events` so the
 *   handler can short-circuit on replay. Stripe re-delivers events on
 *   non-2xx responses, network errors, and during replays from the
 *   dashboard; without dedup, a `payment_intent.succeeded` replay would
 *   attempt to create a second order.
 *   Called by: app/api/stripe/webhooks/route.ts
 * @dependencies lib/supabase/service.ts
 */

import 'server-only'

import type { createServiceClient } from '@/lib/supabase/service'

type ServiceClient = ReturnType<typeof createServiceClient>

type RecordResult = {
  isDuplicate: boolean
}

/**
 * Records a Stripe event in stripe_events; reports whether it's a duplicate.
 * @param eventId - Stripe's event.id (unique per event delivery)
 * @param eventType - Stripe's event.type (e.g. 'payment_intent.succeeded')
 * @param supabase - Service-role client (stripe_events has no user-role policy)
 * @returns { isDuplicate: true } if the event was already recorded; { isDuplicate: false } otherwise
 * @called-by app/api/stripe/webhooks/route.ts
 */
export async function recordEvent(
  eventId: string,
  eventType: string,
  supabase: ServiceClient
): Promise<RecordResult> {
  // INSERT ... ON CONFLICT DO NOTHING means a duplicate event produces no
  // inserted row. The Supabase client doesn't expose raw ON CONFLICT; we use
  // .upsert with ignoreDuplicates so the unique constraint collision is
  // silent. Then RETURNING (via .select) tells us whether our insert stuck:
  // empty result ⇒ someone else inserted it first ⇒ duplicate delivery.
  const { data, error } = await supabase
    .from('stripe_events')
    .upsert(
      { stripe_event_id: eventId, event_type: eventType },
      { onConflict: 'stripe_event_id', ignoreDuplicates: true }
    )
    .select('id')

  if (error) {
    // Propagate: the webhook handler must return non-2xx so Stripe retries.
    throw error
  }

  return { isDuplicate: (data?.length ?? 0) === 0 }
}
