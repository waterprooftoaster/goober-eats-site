/**
 * @file page.tsx
 * @description My Orders history page. Server-renders the authenticated
 *   user's full order history, merging both legs (orders they placed +
 *   orders they fulfilled as a swiper) into a single newest-first list.
 *   Replaces the prior eateries(name) join + items column with the new
 *   restaurant_name / total_cents shape per CLAUDE.md domain model.
 *   Called by: Next.js routing (/orders)
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts,
 *   components/ui/surface.tsx
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api/helpers'
import { Surface } from '@/components/ui/surface'
import type { OrderStatus } from '@/lib/types/database'

interface OrdersRow {
  id: string
  status: OrderStatus
  restaurant_name: string | null
  total_cents: number
  created_at: string
  orderer_id: string | null
  swiper_id: string | null
}

type Role = 'placed' | 'fulfilled'

/**
 * Renders the merged orderer + swiper history for the authenticated user.
 * @returns Order history list UI; redirects to /auth/login if anonymous
 * @called-by Next.js routing (/orders)
 */
export default async function MyOrdersPage() {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) redirect('/auth/login')

  const { data } = await supabase
    .from('orders')
    .select('id, status, restaurant_name, total_cents, created_at, orderer_id, swiper_id')
    .or(`orderer_id.eq.${user.id},swiper_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  const rows = ((data ?? []) as OrdersRow[]).map((o) => ({
    id: o.id,
    status: o.status,
    restaurantName: o.restaurant_name ?? '',
    totalCents: o.total_cents,
    createdAt: o.created_at,
    role: (o.orderer_id === user.id ? 'placed' : 'fulfilled') as Role,
  }))

  return (
    <main
      data-testid="orders-page"
      className="mx-auto max-w-3xl py-8 sm:py-12"
    >
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Order history.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Every order you&rsquo;ve placed and fulfilled.
        </p>
      </header>

      {rows.length === 0 ? (
        <Surface
          tone="subtle"
          padding="lg"
          data-testid="orders-empty-state"
          className="flex flex-col items-start gap-1"
        >
          <p className="text-base font-medium">No orders yet.</p>
          <p className="text-sm text-muted-foreground">
            Place an order or accept one to start your history.
          </p>
        </Surface>
      ) : (
        <ul data-testid="orders-list" className="flex flex-col gap-3">
          {rows.map((order) => (
            <li key={order.id}>
              <article className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {order.restaurantName || 'Order'}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span
                        data-testid="orders-role-badge"
                        data-role={order.role}
                        className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-secondary-foreground"
                      >
                        {order.role === 'placed' ? 'Placed' : 'Fulfilled'}
                      </span>
                      <span aria-hidden>·</span>
                      <span>{formatDate(order.createdAt)}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">
                      {formatDollars(order.totalCents)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {STATUS_LABEL[order.status]}
                    </p>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

// --- Helpers ---

const STATUS_LABEL: Record<OrderStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

/** Formats integer cents as a US dollar string (e.g. 500 → "$5.00"). */
function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/** Formats an ISO timestamp as a short en-US locale date (e.g. "Apr 23, 2026"). */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
