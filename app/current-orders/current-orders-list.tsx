'use client'

/**
 * @file current-orders-list.tsx
 * @description Client list of active orders, each rendered as a tinted card
 *   with an embedded ChatView. Status badge variants follow the OKLCH-126
 *   palette; the list shows an empty-state Surface when no rows are present.
 *   Called by: app/current-orders/page.tsx
 * @dependencies components/chat/chat-view.tsx, components/chat-panel,
 *   components/ui/surface.tsx
 */

import { useState } from 'react'
import { X } from 'lucide-react'
import { ChatView } from '@/components/chat/chat-view'
import { useChatPanel } from '@/components/chat-panel'
import { Surface } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/lib/types/database'

interface CurrentOrderListItem {
  id: string
  status: OrderStatus
  restaurantName: string
  cartScreenshotUrl: string | null
}

interface Props {
  orders: CurrentOrderListItem[]
  currentUserId: string
}

/**
 * Renders the active-orders list. Empty state, populated cards, and
 * per-card status badges all carry catalog testids.
 * @param orders - Already-fetched + projected orders (server query)
 * @param currentUserId - Authed user ID forwarded to the embedded ChatView
 * @called-by app/current-orders/page.tsx
 */
export function CurrentOrdersList({ orders, currentUserId }: Props) {
  const { orders: panelOrders, updateOrderStatus } = useChatPanel()
  // Locally-removed orders for instant UI feedback after un-accept / cancel.
  // We deliberately keep `completed` orders mounted so the swiper sees
  // OrderCompletedView (with the completion photo) until they navigate away;
  // the next mount re-runs the server query (`['open', 'in_progress']`) which
  // drops the row.
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())

  function handleStatusChange(orderId: string, status: OrderStatus) {
    updateOrderStatus(orderId, status)
    if (status === 'open' || status === 'cancelled') {
      setRemovedIds((prev) => {
        if (prev.has(orderId)) return prev
        const next = new Set(prev)
        next.add(orderId)
        return next
      })
    }
  }

  function handleDismiss(orderId: string) {
    setRemovedIds((prev) => {
      if (prev.has(orderId)) return prev
      const next = new Set(prev)
      next.add(orderId)
      return next
    })
  }

  // Resolve the live status from the chat-panel-provider when available — the
  // provider subscribes to realtime UPDATEs and is also the sink for
  // handleStatusChange above, so it reflects the swiper marking complete /
  // un-accepting and the orderer's view of those events. Server-fetched
  // status is the fallback for the brief window before loadActiveOrders runs.
  const visibleOrders = orders
    .filter((o) => !removedIds.has(o.id))
    .map((o) => ({ ...o, status: panelOrders[o.id]?.status ?? o.status }))

  if (visibleOrders.length === 0) {
    return (
      <Surface
        tone="subtle"
        padding="lg"
        data-testid="current-orders-empty-state"
        className="flex flex-col items-start gap-1"
      >
        <p className="text-base font-medium">No active orders.</p>
        <p className="text-sm text-muted-foreground">
          When you place an order or accept one, it&rsquo;ll show up here.
        </p>
      </Surface>
    )
  }

  return (
    <div data-testid="current-orders-list" className="flex flex-col gap-4">
      {visibleOrders.map((order) => (
        <article
          key={order.id}
          className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
        >
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="truncate text-sm font-semibold text-foreground">
                {order.restaurantName || 'Order'}
              </span>
              <span className="text-xs text-muted-foreground">
                #{order.id.slice(0, 8)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={order.status} />
              {order.status === 'completed' && (
                <button
                  type="button"
                  onClick={() => handleDismiss(order.id)}
                  data-testid="current-orders-dismiss-button"
                  aria-label="Dismiss completed order"
                  className="-mr-1 inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </header>
          <div className={cn('flex flex-col', order.status !== 'completed' && 'h-[26rem]')}>
            <ChatView
              orderId={order.id}
              currentUserId={currentUserId}
              orderStatus={order.status}
              eateryName={order.restaurantName}
              cartScreenshotUrl={order.cartScreenshotUrl}
              onStatusChange={(status) => handleStatusChange(order.id, status)}
            />
          </div>
        </article>
      ))}
    </div>
  )
}

// --- Helpers ---

const STATUS_LABEL: Record<OrderStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_TONE: Record<OrderStatus, string> = {
  open: 'bg-secondary text-secondary-foreground',
  in_progress: 'bg-primary/15 text-foreground',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
}

/**
 * Per-order status pill. Picks a tinted background per status and stamps
 * the catalog `current-orders-status-badge` testid for E2E assertions.
 */
function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      data-testid="current-orders-status-badge"
      data-status={status}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        STATUS_TONE[status]
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}
