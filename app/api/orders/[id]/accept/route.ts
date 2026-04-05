import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'
import { sendSystemMessage } from '@/lib/chat/system-messages'
import type { Order } from '@/lib/types/database'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) return apiError('Unauthorized', 401)

  // Verify order exists and is pending; include eatery_id for school check below
  const { data: order } = await supabase
    .from('orders')
    .select('id, orderer_id, swiper_id, eatery_id, status')
    .eq('id', id)
    .single()

  if (!order) return apiError('Order not found', 404)
  if (order.status !== 'open' || order.swiper_id !== null) {
    return apiError('Order is no longer available', 409)
  }
  if (order.orderer_id === user.id) {
    return apiError('Cannot accept your own order', 403)
  }

  // Verify swiper has completed Stripe onboarding
  const { data: stripeAccount } = await supabase
    .from('stripe_accounts')
    .select('onboarding_complete')
    .eq('user_id', user.id)
    .single()

  if (!stripeAccount?.onboarding_complete) {
    return apiError('Stripe onboarding must be completed first', 403)
  }

  // Verify swiper is registered and has a school
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_swiper, school_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.is_swiper) {
    return apiError('You must be a registered swiper to accept orders', 403)
  }
  if (!profile.school_id) {
    return apiError('You must select a school before accepting orders', 403)
  }

  // Verify the order's eatery belongs to the swiper's school (prevents cross-school acceptance)
  const { data: eatery } = await supabase
    .from('eateries')
    .select('school_id, name')
    .eq('id', order.eatery_id)
    .single()

  if (!eatery || eatery.school_id !== profile.school_id) {
    return apiError('This order is not from your school', 403)
  }

  // Atomic update — uses service client to bypass RLS (the accept operation sets swiper_id
  // from null to the accepting user; no RLS policy covers this "claim" transition).
  // All authorization checks above use the user client to ensure the swiper is eligible.
  const service = createServiceClient()
  const { data: updated, error } = await service
    .from('orders')
    .update({ swiper_id: user.id, status: 'in_progress' as const })
    .eq('id', id)
    .eq('status', 'open')
    .is('swiper_id', null)
    .select(
      'id, orderer_id, swiper_id, eatery_id, status, items, total_cents, tip_cents, special_instructions, guest_name, guest_phone, created_at, updated_at'
    )
    .single()

  if (error || !updated) {
    return apiError('Order was already accepted by another swiper', 409)
  }
  const { error: convError } = await service
    .from('conversations')
    .insert({
      order_id: updated.id,
      orderer_id: updated.orderer_id,
      swiper_id: user.id,
    })

  // Handle re-acceptance after cancellation (unique violation on order_id)
  if (convError?.code === '23505') {
    await service
      .from('conversations')
      .update({ swiper_id: user.id })
      .eq('order_id', updated.id)
  }

  const swiperName = profile.full_name ?? 'A swiper'
  const eateryName = eatery?.name ?? 'the eatery'
  const orderShortId = updated.id.slice(0, 8)

  await sendSystemMessage(
    updated.id,
    `${swiperName} accepted order #${orderShortId} at ${eateryName}.`
  )

  return apiSuccess(updated)
}
