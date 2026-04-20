/**
 * @file page.tsx
 * @description Guest order entry page that validates the order token cookie and renders GuestPanelOpener.
 *   Only serves unauthenticated guests; authenticated users are redirected to home immediately.
 *   Called by: Stripe checkout return redirect (guest flow)
 * @dependencies lib/supabase/server.ts, lib/supabase/service.ts, lib/api/guest-auth.ts
 */

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { guestOrderCookieName } from '@/lib/api/guest-auth'
import { GuestPanelOpener } from './guest-panel-opener'
import type { OrderStatus } from '@/lib/types/database'

const uuidSchema = z.string().uuid()

/**
 * Validates the guest order token cookie and renders GuestPanelOpener to bootstrap the chat session.
 * @returns GuestPanelOpener component; redirects to / if the token is missing or invalid
 * @called-by Stripe checkout return redirect (guest flow)
 */
export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params

  if (!uuidSchema.safeParse(orderId).success) {
    redirect('/')
  }

  // Any existing session (auth or anonymous) means panels are managed by ChatPanelProvider
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    redirect('/')
  }

  // No session — guest bootstrap path
  const cookieStore = await cookies()
  const token = cookieStore.get(guestOrderCookieName(orderId))?.value
  if (!token) {
    redirect('/')
  }

  const serviceClient = createServiceClient()
  const { data: order } = await serviceClient
    .from('orders')
    .select('id, status, guest_access_token, orderer_id, eateries(name)')
    .eq('id', orderId)
    .maybeSingle()

  // Redirect if order not found, token mismatch, or this is an auth user's order
  if (!order || order.guest_access_token !== token || order.orderer_id !== null) {
    redirect('/')
  }

  const eateryName = (order.eateries as unknown as { name: string } | null)?.name ?? ''

  return (
    <GuestPanelOpener orderId={order.id} initialStatus={order.status as OrderStatus} eateryName={eateryName} />
  )
}
