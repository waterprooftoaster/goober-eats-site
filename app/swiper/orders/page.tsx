/**
 * @file page.tsx
 * @description Open orders page for swipers; lists unclaimed orders from the swiper's school, oldest first.
 *   Called by: Next.js routing (direct navigation to /swiper/orders)
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts, app/swiper/orders/pending-orders-list.tsx
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api/helpers'
import { PendingOrdersList, type PendingOrder } from './pending-orders-list'

/**
 * Fetches open unclaimed orders for the swiper's school and renders PendingOrdersList.
 * @returns PendingOrdersList; redirects to /auth/login if unauthenticated or /account if not a swiper
 * @called-by Next.js routing (/swiper/orders)
 */
export default async function PendingOrdersPage() {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_swiper, school_id')
    .eq('id', user.id)
    .single()

  // Belt-and-suspenders: layout guard should have caught this, but defend explicitly
  if (!profile?.is_swiper) redirect('/account?notice=swiper_required')

  let orders: PendingOrder[] = []

  if (profile?.school_id) {
    const { data } = await supabase
      .from('orders')
      .select('id, total_cents, restaurant_name, cart_screenshot_urls, created_at')
      .eq('status', 'open')
      .is('swiper_id', null)
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: true })
    orders = (data ?? []).map((row) => ({
      id: row.id,
      total_cents: row.total_cents,
      restaurant_name: row.restaurant_name,
      cart_screenshot_urls: (row.cart_screenshot_urls as string[]) ?? [],
      created_at: row.created_at,
    }))
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <h1 className="text-2xl font-bold mb-2">Open Orders</h1>
        <p className="text-sm text-gray-500 mb-8">
          Orders from your school — oldest first. Tap an order to see details and accept it.
        </p>
        <PendingOrdersList orders={orders} />
      </div>
    </main>
  )
}
