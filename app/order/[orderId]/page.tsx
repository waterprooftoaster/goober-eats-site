/**
 * @file page.tsx
 * @description Guest order entry page. Validates the order-token cookie server-side
 *   and renders GuestPanelOpener for the ~1s bootstrap. Only serves genuinely
 *   unauthenticated visitors; any existing session (anon or authed) is redirected
 *   home so the global ChatPanelProvider takes over panel management.
 *   Called by: Stripe checkout return redirect (guest flow, via /api/guest/verify-order)
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

  // Real authed users are managed by ChatPanelProvider on /; anon-session guests
  // (HomeUpload calls signInAnonymously before checkout) must fall through to
  // GuestPanelOpener so it can PATCH orders.anon_user_id — without that link
  // ChatPanelProvider's loadActiveOrders query (anon_user_id=eq.<id>) returns
  // nothing and the chat panel never opens.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user && !user.is_anonymous) {
    redirect('/')
  }

  // No session — guest bootstrap path
  const cookieStore = await cookies()
  const token = cookieStore.get(guestOrderCookieName(orderId))?.value
  if (!token) {
    redirect('/')
  }

  // Schema rewrite: the legacy `eateries(name)` join is gone (CLAUDE.md domain model).
  // `orders.restaurant_name` is the new source of truth.
  const serviceClient = createServiceClient()
  const { data: order } = await serviceClient
    .from('orders')
    .select('id, status, guest_access_token, orderer_id, restaurant_name, school_id')
    .eq('id', orderId)
    .maybeSingle()

  if (!order || order.guest_access_token !== token || order.orderer_id !== null) {
    redirect('/')
  }

  return (
    <GuestPanelOpener
      orderId={order.id}
      initialStatus={order.status as OrderStatus}
      eateryName={order.restaurant_name ?? ''}
      schoolId={order.school_id}
    />
  )
}
