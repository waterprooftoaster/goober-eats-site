/**
 * @file route.ts
 * @description PATCH endpoint to advance an order through the state machine.
 *   Validates transitions, enforces per-role authorization, guards completion (payment + delivery photo),
 *   triggers Stripe transfer on completion, and sends system chat messages on status change.
 *   Called by: swiper/orderer order action buttons
 * @dependencies lib/supabase/server.ts, lib/supabase/service.ts, lib/orders/state-machine.ts,
 *               lib/stripe/transfer.ts, lib/chat/system-messages.ts
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { updateOrderStatusSchema } from '@/lib/types/api'
import { canTransition } from '@/lib/orders/state-machine'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'
import { transferToSwiper } from '@/lib/stripe/transfer'
import { sendSystemMessage } from '@/lib/chat/system-messages'
import type { OrderStatus } from '@/lib/types/database'

const STATUS_MESSAGES: Partial<Record<string, string>> = {
  open: 'Swiper is no longer available — your order is open again',
  completed: 'Order completed — check completion photo',
  cancelled: 'Order was cancelled',
}

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

  // Authorization: orderer can only cancel (from open); swiper drives the rest
  const isOrderer = order.orderer_id === user.id
  const isSwiper = order.swiper_id === user.id

  if (newStatus === 'cancelled') {
    if (!isOrderer) {
      return apiError('Only the orderer can cancel an order', 403)
    }
  } else {
    // open (un-accept) and completed — swiper only
    if (!isSwiper) {
      return apiError('Only the swiper can update this status', 403)
    }
  }

  // Completion guards: payment must exist + delivery photo required
  // Uses service client: RLS on payments only allows payer/payee to SELECT, but
  // the swiper is neither (payer_id = orderer, payee_id = null at this point).
  if (newStatus === 'completed') {
    const { data: payment } = await createServiceClient()
      .from('payments')
      .select('id')
      .eq('order_id', id)
      .eq('status', 'succeeded')
      .maybeSingle()

    if (!payment) {
      return apiError('Order cannot be completed: payment not confirmed', 400)
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
  const updatePayload = newStatus === 'open'
    ? { status: newStatus, swiper_id: null }
    : { status: newStatus }
  const updateClient = newStatus === 'open' ? createServiceClient() : supabase

  // Atomic: only update if status still matches what we read (prevents race)
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

  // Transfer funds to swiper (payment captured at checkout for both guest and auth)
  if (newStatus === 'completed' && updated.swiper_id) {
    await transferToSwiper(updated.id, updated.swiper_id, updated.total_cents)
  }

  if (STATUS_MESSAGES[newStatus]) {
    await sendSystemMessage(id, STATUS_MESSAGES[newStatus]!)
  }

  return apiSuccess(updated)
}
