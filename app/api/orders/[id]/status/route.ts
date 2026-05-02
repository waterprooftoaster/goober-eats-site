/**
 * @file route.ts
 * @description PATCH endpoint to advance an order through the state machine.
 *   Validates transitions, enforces per-role authorization, guards completion
 *   (payment + completion photo). Under manual-capture, completion captures
 *   the orderer's authorized PI and transfers the net to the swiper via
 *   lib/stripe/capture-and-transfer.ts BEFORE the status flips to 'completed'
 *   — capture failure leaves the order at in_progress so ops can resolve.
 *   Status notifications are NOT persisted here — the chat UI renders them
 *   client-side as pseudo-messages derived from order.status + viewer role.
 *   Called by: swiper/orderer order action buttons
 * @dependencies lib/supabase/server.ts, lib/supabase/service.ts, lib/orders/state-machine.ts,
 *               lib/stripe/capture-and-transfer.ts
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { updateOrderStatusSchema } from '@/lib/types/api'
import { canTransition } from '@/lib/orders/state-machine'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'
import { validateGuestOrder } from '@/lib/api/guest-auth'
import { captureAndTransfer } from '@/lib/stripe/capture-and-transfer'
import { getStripe } from '@/lib/stripe/client'
import { signCartScreenshotPaths } from '@/lib/storage/sign-screenshots'
import type { OrderStatus } from '@/lib/types/database'

/**
 * Advances an order through the state machine; triggers Stripe transfer on completion.
 * @param params - Route params containing the order UUID
 * @returns Updated order row on success; 400/401/403/404/409 on validation, auth, or race failures
 * @called-by swiper/orderer order action buttons
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) return apiError('Unauthorized', 401)

  const body = await request.json()
  const parsed = updateOrderStatusSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400)
  }
  const { status: newStatus } = parsed.data

  const { data: order } = await supabase
    .from('orders')
    .select('id, orderer_id, swiper_id, status, stripe_payment_intent_id')
    .eq('id', id)
    .single()

  if (!order) return apiError('Order not found', 404)

  if (!canTransition(order.status as OrderStatus, newStatus)) {
    return apiError(
      `Cannot transition from ${order.status} to ${newStatus}`,
      400
    )
  }

  // Authorization: orderer can only cancel (from open); swiper drives the rest
  const isOrderer = order.orderer_id === user.id
  const isSwiper = order.swiper_id === user.id

  if (newStatus === 'cancelled') {
    // Allow either the authenticated orderer OR a guest holding the matching
    // guest_access_token cookie. Guest orders have orderer_id NULL by design,
    // so isOrderer is always false for them — we re-check via validateGuestOrder.
    let canCancel = isOrderer
    if (!canCancel && order.orderer_id === null) {
      const { error: guestErr } = await validateGuestOrder(id)
      canCancel = guestErr === null
    }
    if (!canCancel) {
      return apiError('Only the orderer can cancel an order', 403)
    }
    // Release the auth hold before flipping status. paymentIntents.cancel is
    // itself idempotent (Stripe returns the canceled PI if called again);
    // wrapping with idempotencyKey 'cancel-${orderId}' guards against retry
    // amplification on transient network errors. On error (rare: PI already
    // captured/canceled) we still flip status so the order doesn't get stuck.
    if (order.stripe_payment_intent_id) {
      try {
        await getStripe().paymentIntents.cancel(
          order.stripe_payment_intent_id,
          undefined,
          { idempotencyKey: `cancel-${id}` }
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error(`Cancel failed for order ${id} (PI ${order.stripe_payment_intent_id}): ${message}. Flipping status anyway.`)
      }
    }
  } else {
    // open (un-accept) and completed — swiper only
    if (!isSwiper) {
      return apiError('Only the swiper can update this status', 403)
    }
  }

  // Completion guards: payment must exist (in pending/succeeded — i.e. not
  // failed/refunded) + completion photo required. Uses service client because
  // RLS on payments only allows payer/payee to SELECT, but the swiper is
  // neither (payer_id = orderer, payee_id = null until transfer succeeds).
  if (newStatus === 'completed') {
    const { data: payment } = await createServiceClient()
      .from('payments')
      .select('id, status')
      .eq('order_id', id)
      .in('status', ['pending', 'succeeded'])
      .maybeSingle()

    if (!payment) {
      return apiError('Order cannot be completed: payment not in a completable state', 400)
    }

    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('order_id', id)
      .single()

    if (conv) {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .eq('message_type', 'completion_photo')

      if (!count || count === 0) {
        return apiError('A completion photo is required to complete the order', 400)
      }
    }
  }

  // Un-accept: clear swiper_id so the order re-enters the open queue.
  // Uses service client because the orders_update RLS WITH CHECK only permits
  // rows where the updater remains orderer or swiper — clearing swiper_id to
  // null would fail the check on the new row even though USING passes.
  // Cancel: also uses service client so guests (whose anon session never
  // matches orderer_id/swiper_id, both NULL on guest orders) can cancel —
  // authorization for the cancel was already enforced via isOrderer +
  // validateGuestOrder above.
  // completed: stamp completed_at so the complaint feature has a canonical
  // completion timestamp (lib/orders/complaint-eligibility.ts reads it).
  const updatePayload =
    newStatus === 'open'
      ? { status: newStatus, swiper_id: null }
      : newStatus === 'completed'
        ? { status: newStatus, completed_at: new Date().toISOString() }
        : { status: newStatus }
  const updateClient =
    newStatus === 'open' || newStatus === 'cancelled'
      ? createServiceClient()
      : supabase

  // Atomic: only update if status still matches what we read (prevents race)
  const { data: updated, error } = await updateClient
    .from('orders')
    .update(updatePayload)
    .eq('id', id)
    .eq('status', order.status)
    .select(
      'id, orderer_id, swiper_id, school_id, restaurant_name, cart_screenshot_urls, status, subtotal_cents, total_cents, guest_name, guest_email, created_at, updated_at, completed_at'
    )
    .single()

  if (error || !updated) {
    // CAS may fail because a concurrent writer already moved the row to
    // newStatus. Most common cause for cancel: stripe.paymentIntents.cancel
    // above triggers a payment_intent.canceled webhook
    // (app/api/stripe/webhooks/route.ts) that flips status='cancelled'
    // before our own UPDATE lands. Re-read; if the row is already at
    // newStatus, return idempotent 200 — the side effects (Stripe cancel,
    // capture+transfer, conversation clear) ran on whichever path won.
    const { data: current } = await updateClient
      .from('orders')
      .select(
        'id, orderer_id, swiper_id, school_id, restaurant_name, cart_screenshot_urls, status, subtotal_cents, total_cents, guest_name, guest_email, created_at, updated_at, completed_at'
      )
      .eq('id', id)
      .single()

    if (current && current.status === newStatus) {
      const cart_screenshot_urls = await signCartScreenshotPaths(
        (current.cart_screenshot_urls as string[] | null) ?? []
      )
      return apiSuccess({ ...current, cart_screenshot_urls })
    }
    return apiError('Order status was changed by another request', 409)
  }

  // Un-accept side-effect: clear conversations.swiper_id so the prior swiper
  // loses RLS access to the conversation + its messages. Without this, the
  // old swiper could keep reading/writing via direct API calls. The accept
  // route's unique-violation branch reattaches conversations.swiper_id when
  // a new swiper picks the order back up.
  if (newStatus === 'open') {
    await createServiceClient()
      .from('conversations')
      .update({ swiper_id: null, swiper_assigned_at: null })
      .eq('order_id', id)
  }

  // Capture the orderer's authorized PI + transfer the net to the swiper.
  // CAS already succeeded so the order is now 'completed' in DB; if capture
  // fails we roll the status back to 'in_progress' and respond 409. The
  // briefly-visible 'completed' state during the Stripe call is acceptable
  // (single Stripe round-trip; idempotent retries).
  if (newStatus === 'completed' && updated.swiper_id) {
    const result = await captureAndTransfer(updated.id, updated.swiper_id)
    if (!result.ok) {
      // Rollback: WHERE id=X AND status='completed' — only this request can
      // be in this state, so the rollback is unambiguous. Service client is
      // required because a concurrent un-accept could have nulled swiper_id,
      // and clearing completed_at to null also avoids the orders_update RLS
      // WITH CHECK on the user-scoped client (same precedent as the un-accept
      // branch above). Clearing completed_at preserves the complaint window
      // so the eventual successful completion gets the full 24h.
      const { error: rollbackError } = await createServiceClient()
        .from('orders')
        .update({ status: 'in_progress', completed_at: null })
        .eq('id', updated.id)
        .eq('status', 'completed')
      if (rollbackError) {
        console.error(
          `Capture failed AND rollback failed for order ${updated.id}`,
          rollbackError
        )
      }

      if (result.reason === 'capture_failed') {
        return apiError(
          'Payment authorization expired or declined; order cannot be completed.',
          409
        )
      }
      // no_payment: completion guard would have caught this; defensive fallback.
      return apiError('Order cannot be completed: payment record not found', 400)
    }
    // result.transferStuck is logged inside captureAndTransfer; the order
    // still completes (food was delivered, orderer was charged).
  }

  const cart_screenshot_urls = await signCartScreenshotPaths(
    (updated.cart_screenshot_urls as string[] | null) ?? []
  )
  return apiSuccess({ ...updated, cart_screenshot_urls })
}
