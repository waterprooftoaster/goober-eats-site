/**
 * @file page.tsx
 * @description Current orders page listing the authenticated user's open and in-progress orders with chat.
 *   Called by: Next.js routing (direct navigation to /current-orders)
 * @dependencies lib/supabase/server.ts, app/current-orders/current-orders-list.tsx
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CurrentOrdersList } from './current-orders-list'
import type { OrderStatus } from '@/lib/types/database'

/**
 * Fetches the authenticated user's active orders and renders them with chat panels.
 * @returns CurrentOrdersList; redirects to /auth/login if unauthenticated
 * @called-by Next.js routing (/current-orders)
 */
export default async function CurrentOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, eateries(name)')
    .eq('orderer_id', user.id)
    .in('status', ['open', 'in_progress', 'completed'])
    .order('created_at', { ascending: false })

  const ordersWithEatery = (orders ?? []).map((o) => ({
    id: o.id,
    status: o.status as OrderStatus,
    eateryName: (o.eateries as unknown as { name: string } | null)?.name ?? '',
  }))

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Current Orders</h1>
      <CurrentOrdersList
        orders={ordersWithEatery}
        currentUserId={user.id}
      />
    </main>
  )
}
