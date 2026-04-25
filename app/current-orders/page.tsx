/**
 * @file page.tsx
 * @description Current-orders surface: server component fetches the user's
 *   active orders (orderer or swiper leg) keyed off the new `restaurant_name`
 *   column, then hands off to the client list which embeds a ChatView per
 *   order. Redirects unauthenticated users to /auth/login.
 *   Called by: Next.js routing (/current-orders); Stripe checkout return.
 * @dependencies lib/supabase/server.ts, ./current-orders-list
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CurrentOrdersList } from './current-orders-list'
import type { OrderStatus } from '@/lib/types/database'

interface CurrentOrderRow {
  id: string
  status: OrderStatus
  restaurant_name: string | null
}

/**
 * Renders the authenticated user's open + in_progress + completed orders.
 * Each row is a card hosting the embedded ChatView; realtime status updates
 * propagate via the ChatPanel provider on the client side.
 * @returns The page element, or a redirect to /auth/login for anon callers
 * @called-by Next.js App Router (/current-orders)
 */
export default async function CurrentOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, restaurant_name')
    .or(`orderer_id.eq.${user.id},swiper_id.eq.${user.id}`)
    .in('status', ['open', 'in_progress', 'completed'])
    .order('created_at', { ascending: false })

  const rows = ((orders ?? []) as CurrentOrderRow[]).map((o) => ({
    id: o.id,
    status: o.status,
    restaurantName: o.restaurant_name ?? '',
  }))

  return (
    <main
      data-testid="current-orders-page"
      className="mx-auto max-w-3xl py-8 sm:py-12"
    >
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Current orders.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your active deliveries — chat with the other side here.
        </p>
      </header>
      <CurrentOrdersList orders={rows} currentUserId={user.id} />
    </main>
  )
}
