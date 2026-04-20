/**
 * @file page.tsx
 * @description My Orders page listing all orders placed by the authenticated user, newest first.
 *   Called by: Next.js routing (direct navigation to /orders)
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api/helpers'

type OrderItem = {
  name: string
  quantity: number
  price_cents: number
}

type EateryJoin = { name: string } | null

type MyOrder = {
  id: string
  status: string
  items: OrderItem[]
  total_cents: number
  created_at: string
  eateries: EateryJoin
}

/**
 * Renders a list of all orders placed by the authenticated user, newest first.
 * @returns Orders list UI; redirects to /auth/login if unauthenticated
 * @called-by Next.js routing (/orders)
 */
export default async function MyOrdersPage() {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) redirect('/auth/login')

  const { data } = await supabase
    .from('orders')
    .select('id, status, items, total_cents, created_at, eateries!orders_eatery_id_fkey(name)')
    .eq('orderer_id', user.id)
    .order('created_at', { ascending: false })

  const orders = ((data ?? []) as unknown) as MyOrder[]

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-bold mb-8">My Orders</h1>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-500">No orders yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {orders.map((order) => (
              <li key={order.id} className="rounded-lg border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium">{order.eateries?.name ?? '—'}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">{formatDollars(order.total_cents)}</p>
                    <p className="text-xs text-gray-400 capitalize mt-0.5">{order.status}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

// --- Helpers ---

/** Formats a cent amount as a US dollar string (e.g. 500 → "$5.00"). */
function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

/** Formats an ISO timestamp as a short locale date string (e.g. "Jan 15, 2025"). */
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
