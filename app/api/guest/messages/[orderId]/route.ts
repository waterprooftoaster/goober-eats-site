/**
 * @file route.ts
 * @description GET endpoint for guests to load their order's conversation and messages.
 *   Called by: app/order/[orderId]/page.tsx (guest view)
 * @dependencies lib/supabase/service.ts, lib/api/guest-auth.ts, lib/api/helpers.ts
 */

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateGuestOrder } from '@/lib/api/guest-auth'
import { apiSuccess } from '@/lib/api/helpers'

/**
 * Returns the conversation and messages for a guest's order, authenticated via cookie.
 * @param params - Route params containing the order UUID
 * @returns JSON { conversation, messages, order_status } or 400/401/403 on auth failure
 * @called-by app/order/[orderId]/page.tsx (guest view)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params

  const auth = await validateGuestOrder(orderId)
  if (auth.error) return auth.error

  const supabase = createServiceClient()

  const [{ data: orderData }, { data: conversation }] = await Promise.all([
    supabase.from('orders').select('status').eq('id', orderId).maybeSingle(),
    supabase.from('conversations').select('*').eq('order_id', orderId).maybeSingle(),
  ])

  const orderStatus = orderData?.status ?? null

  if (!conversation) {
    return apiSuccess({ conversation: null, messages: [], order_status: orderStatus })
  }

  const [{ data: messages }, { data: swiperProfile }] = await Promise.all([
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('sent_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', conversation.swiper_id)
      .maybeSingle(),
  ])

  const enriched = { ...conversation, swiper_full_name: swiperProfile?.full_name ?? null }
  return apiSuccess({ conversation: enriched, messages: messages ?? [], order_status: orderStatus })
}
