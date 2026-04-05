import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { guestOrderCookieName } from '@/lib/api/guest-auth'
import { GuestOrderPanelOpener } from './guest-order-panel-opener'
import type { OrderStatus } from '@/lib/types/database'

const uuidSchema = z.string().uuid()

export default async function GuestOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params

  if (!uuidSchema.safeParse(orderId).success) {
    redirect('/')
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(guestOrderCookieName(orderId))?.value

  if (!token) {
    redirect('/')
  }

  const supabase = createServiceClient()
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, guest_access_token, orderer_id')
    .eq('id', orderId)
    .maybeSingle()

  // Redirect if order not found, token mismatch, or this is an auth user's order
  if (!order || order.guest_access_token !== token || order.orderer_id !== null) {
    redirect('/')
  }

  return (
    <GuestOrderPanelOpener orderId={order.id} initialStatus={order.status as OrderStatus} />
  )
}
