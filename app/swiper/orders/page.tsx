/**
 * @file page.tsx
 * @description Swiper queue page: server-fetches open unclaimed orders for
 *   the swiper's school, oldest first, then hands off to the client list.
 *   The §10 security gate lives in app/swiper/layout.tsx — this page only
 *   defends with belt-and-suspenders against a missing profile row.
 *   Called by: Next.js routing (/swiper/orders); SwiperOrdersButton link.
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts,
 *   ./pending-orders-list
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api/helpers'
import { signCartScreenshotPaths } from '@/lib/storage/sign-screenshots'
import { PendingOrdersList, type PendingOrder } from './pending-orders-list'

/**
 * Renders the swiper queue page; fetches open unclaimed orders at the
 * swiper's school for the client list to hydrate.
 * @returns The page element, or a redirect if profile is missing
 * @called-by Next.js App Router (/swiper/orders)
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

  // Belt-and-suspenders: app/swiper/layout.tsx already gates non-swipers,
  // but defend explicitly so a future routing refactor cannot silently
  // expose this page.
  if (!profile?.is_swiper) redirect('/account?notice=swiper_required')

  let orders: PendingOrder[] = []
  if (profile?.school_id) {
    const { data } = await supabase
      .from('orders')
      .select('id, subtotal_cents, restaurant_name, cart_screenshot_urls, created_at')
      .eq('status', 'open')
      .is('swiper_id', null)
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: true })
    orders = await Promise.all(
      (data ?? []).map(async (row) => ({
        id: row.id,
        subtotal_cents: row.subtotal_cents,
        restaurant_name: row.restaurant_name,
        cart_screenshot_urls: await signCartScreenshotPaths(
          (row.cart_screenshot_urls as string[] | null) ?? []
        ),
        created_at: row.created_at,
      }))
    )
  }

  return (
    <main
      data-testid="swiper-orders-page"
      className="mx-auto max-w-2xl py-8 sm:py-12"
    >
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Open orders.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Orders from your school, oldest first. Tap one to see the cart and accept.
        </p>
      </header>
      <PendingOrdersList orders={orders} />
    </main>
  )
}
