/**
 * @file page.tsx
 * @description My Orders history page. Server-renders the authenticated
 *   user's full order history, merging both legs (orders they placed +
 *   orders they fulfilled as a swiper) into a single newest-first list.
 *   Per-row amount: placed = what the orderer paid (total_cents);
 *   fulfilled = what the swiper earned (computeSplit(subtotal).swiperReceivesCents).
 *   Called by: Next.js routing (/orders)
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts,
 *   components/ui/surface.tsx, lib/pricing.ts
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api/helpers'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { computeSplit } from '@/lib/pricing'
import { isWithinComplaintWindow } from '@/lib/orders/complaint-eligibility'
import type { ComplaintVerdict, OrderStatus } from '@/lib/types/database'

interface ComplaintSummary {
  id: string
  verdict: ComplaintVerdict
}

interface OrdersRow {
  id: string
  status: OrderStatus
  restaurant_name: string | null
  subtotal_cents: number
  total_cents: number
  created_at: string
  completed_at: string | null
  orderer_id: string | null
  swiper_id: string | null
  complaints: ComplaintSummary[] | ComplaintSummary | null
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
    .select(
      'id, status, restaurant_name, subtotal_cents, total_cents, created_at, completed_at, orderer_id, swiper_id, complaints(id, verdict)'
    )
    .or(`orderer_id.eq.${user.id},swiper_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  const rows = ((data ?? []) as OrdersRow[]).map((o) => {
    const role: Role = o.orderer_id === user.id ? 'placed' : 'fulfilled'
    // For placed orders show what the orderer paid; for fulfilled orders
    // show what the swiper earned.
    const amountCents =
      role === 'placed'
        ? o.total_cents
        : computeSplit(o.subtotal_cents).swiperReceivesCents
    const complaint: ComplaintSummary | null = pickComplaint(o.complaints)
    const canComplain =
      role === 'placed' &&
      o.status === 'completed' &&
      complaint === null &&
      isWithinComplaintWindow(o.completed_at)
    return {
      id: o.id,
      status: o.status,
      restaurantName: o.restaurant_name ?? '',
      amountCents,
      createdAt: o.created_at,
      role,
      canComplain,
      complaintVerdict: complaint?.verdict ?? null,
    }
  })

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
                      {formatDollars(order.amountCents)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {STATUS_LABEL[order.status]}
                    </p>
                  </div>
                </div>
                {order.canComplain && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      asChild
                      variant="outline"
                      size="xs"
                      data-testid="orders-row-complaint-button"
                    >
                      <Link href={`/orders/${order.id}/complaints/new`}>
                        Report a problem
                      </Link>
                    </Button>
                  </div>
                )}
                {order.complaintVerdict !== null && (
                  <div className="mt-3 flex justify-end">
                    <p
                      data-testid="orders-row-complaint-pill"
                      data-verdict={order.complaintVerdict}
                      className="text-xs text-muted-foreground"
                    >
                      {VERDICT_LABEL[order.complaintVerdict]}
                    </p>
                  </div>
                )}
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

const VERDICT_LABEL: Record<ComplaintVerdict, string> = {
  pending: 'Complaint pending review',
  approve_refund: 'Refund issued',
  deny: 'Complaint denied',
  escalate: 'Complaint pending review',
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

/** Supabase relational selects can return a single row OR an array of rows depending on FK
 *  cardinality; pick the first complaint regardless of shape (one-per-order is enforced in DB). */
function pickComplaint(
  raw: ComplaintSummary[] | ComplaintSummary | null
): ComplaintSummary | null {
  if (raw == null) return null
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw
}
