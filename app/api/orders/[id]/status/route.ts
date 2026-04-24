/**
 * @file route.ts
 * @description PATCH endpoint to advance an order through the state machine.
 *   Validates transitions (`canTransition`), enforces per-role authorization,
 *   refunds the orderer via Stripe on open → cancelled, guards completion
 *   via `canComplete` (payment must be succeeded + not disputed) plus the
 *   "completion photo required" rule, triggers the platform → swiper Stripe
 *   transfer on completion, and posts a system message on status change.
 *   Called by: swiper/orderer order action buttons
 * @dependencies lib/supabase/server.ts, lib/supabase/service.ts, lib/orders/state-machine.ts,
 *               lib/stripe/client.ts, lib/stripe/transfer.ts, lib/chat/system-messages.ts
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripe } from '@/lib/stripe/client'
import { updateOrderStatusSchema } from '@/lib/types/api'
import { canTransition, canComplete } from '@/lib/orders/state-machine'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'
import { transferToSwiper } from '@/lib/stripe/transfer'
import { sendSystemMessage } from '@/lib/chat/system-messages'
import type { OrderStatus, Payment } from '@/lib/types/database'

const STATUS_MESSAGES: Partial<Record<string, string>> = {
  open: 'Swiper is no longer available — your order is open again',
  completed: 'Order completed — check completion photo',
  cancelled: 'Order was cancelled',
}

/**
 * Advances an order through the state machine; refunds on cancel; transfers on completion.
 * @param params - Route params containing the order UUID
 * @returns Updated order row on success; 400/401/403/404/409/500 on validation, auth, race, or Stripe failures
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
    .select('id, orderer_id, swiper_id, status')
    .eq('id', id)
    .single()

  if (!order) return apiError('Order not found', 404)

  if (!canTransition(order.status as OrderStatus, newStatus)) {
    return apiError(
      `Cannot transition from ${order.status} to ${newStatus}`,
      400
    )
  }

  const isOrderer = order.orderer_id === user.id
  const isSwiper = order.swiper_id === user.id

  if (newStatus === 'cancelled') {
    if (!isOrderer) {
      return apiError('Only the orderer can cancel an order', 403)
    }
  } else {
    if (!isSwiper) {
      return apiError('Only the swiper can update this status', 403)
    }
  }

  // Completion guards: payment must be succeeded (not disputed) + a
  // completion_photo message must exist on the conversation.
  if (newStatus === 'completed') {
    const service = createServiceClient()
    const { data: payment } = await service
      .from('payments')
      .select('id, order_id, stripe_payment_intent_id, amount_cents, platform_fee_cents, status, payer_id, payee_id, created_at')
      .eq('order_id', id)
      .maybeSingle()

    const guard = canComplete(payment as Payment | null)
    if (!guard.ok) {
      return apiError(guard.reason, 400)
    }

    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('order_id', id)
      .single()

    // A completion photo is impossible without a conversation — bail
    // unconditionally rather than silently passing when `conv` is null.
    if (!conv) {
      return apiError('A completion photo is required to complete the order', 400)
    }

    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
      .eq('message_type', 'completion_photo')

    if (!count || count === 0) {
      return apiError('A completion photo is required to complete the order', 400)
    }
  }

  // Cancel branch: refund the orderer BEFORE updating order status. If the
  // refund fails we return 500 and leave the order at 'open' so retrying
  // the cancel call goes through idempotently (same idempotencyKey).
  if (newStatus === 'cancelled') {
    const refundResult = await refundOrderPayment(id)
    if (!refundResult.ok) {
      return apiError(refundResult.reason, refundResult.status)
    }
  }

  const updatePayload = newStatus === 'open'
    ? { status: newStatus, swiper_id: null }
    : { status: newStatus }
  const updateClient = newStatus === 'open' ? createServiceClient() : supabase

  const { data: updated, error } = await updateClient
    .from('orders')
    .update(updatePayload)
    .eq('id', id)
    .eq('status', order.status)
    .select(
      'id, orderer_id, swiper_id, school_id, restaurant_name, cart_screenshot_urls, status, total_cents, guest_name, guest_phone, created_at, updated_at'
    )
    .single()

  if (error || !updated) {
    return apiError('Order status was changed by another request', 409)
  }

  if (newStatus === 'completed' && updated.swiper_id) {
    await transferToSwiper(updated.id, updated.swiper_id, updated.total_cents)
  }

  if (STATUS_MESSAGES[newStatus]) {
    await sendSystemMessage(id, STATUS_MESSAGES[newStatus]!)
  }

  return apiSuccess(updated)
}

// --- Helpers ---

type RefundOutcome =
  | { ok: true }
  | { ok: false; reason: string; status: number }

/**
 * Refunds the payment backing an order via Stripe, then marks the payment
 *   row refunded. Idempotent on `refund-${orderId}` so re-calling the
 *   cancel endpoint after a prior failure is safe.
 * @param orderId - The order being cancelled
 * @returns Success, or a structured error to surface to the caller
 * @called-by PATCH handler (cancel branch) above
 */
async function refundOrderPayment(orderId: string): Promise<RefundOutcome> {
  const service = createServiceClient()

  const { data: payment } = await service
    .from('payments')
    .select('id, stripe_payment_intent_id, status')
    .eq('order_id', orderId)
    .maybeSingle()

  // No payment yet means the webhook hasn't run; nothing to refund, but
  // cancelling is still appropriate for orderer peace of mind. (This path
  // is unusual — the webhook runs synchronously after payment capture.)
  if (!payment) return { ok: true }

  // Already refunded (e.g. via charge.refunded webhook race). No-op.
  if (payment.status === 'refunded') return { ok: true }

  try {
    await getStripe().refunds.create(
      { payment_intent: payment.stripe_payment_intent_id },
      { idempotencyKey: `refund-${orderId}` }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`refund failed for order ${orderId}: ${message}`)
    return {
      ok: false,
      reason: 'Failed to issue refund; your order has not been cancelled. Please try again.',
      status: 500,
    }
  }

  const { error: updateError } = await service
    .from('payments')
    .update({ status: 'refunded' })
    .eq('id', payment.id)

  if (updateError) {
    // Refund succeeded on Stripe but we couldn't persist. The
    // charge.refunded webhook will reconcile, so treat this as success.
    console.error(
      `refund succeeded on Stripe but failed to mark payment ${payment.id} refunded: ${updateError.message}`
    )
  }

  return { ok: true }
}
