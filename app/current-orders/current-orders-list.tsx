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
import { OrderIdentity, StatusBadge } from './_card-parts'

interface CurrentOrderListItem {
  id: string
  status: OrderStatus
  restaurantName: string
  cartScreenshotUrl: string | null
  // Pre-resolved by the server query's LEFT JOIN on conversations(id) so
  // the embedded ChatView's useMessages skips its own conversation lookup.
  // Null when no conversation exists yet (status='open' before swiper accepts).
  conversationId: string | null
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
  // Local mirror of swiper-driven status changes. The chat-panel-provider's
  // loadActiveOrders + realtime subscription filter on orderer_id, so for
  // orders the user is *swiping* (not ordering) panelOrders never carries an
  // entry and updateOrderStatus is a no-op. Without this, marking complete
  // leaves the UI stuck on the in_progress banner until a refresh.
  const [localStatuses, setLocalStatuses] = useState<Record<string, OrderStatus>>({})

  function handleStatusChange(orderId: string, status: OrderStatus) {
    setLocalStatuses((prev) => (prev[orderId] === status ? prev : { ...prev, [orderId]: status }))
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

  // Status resolution priority:
  //   1. localStatuses — covers swiper-side completes/un-accepts that the
  //      chat-panel-provider doesn't track (its filter targets orderer_id).
  //   2. panelOrders — orderer-side: realtime UPDATE feed + provider sink for
  //      handleStatusChange propagated from other tabs/contexts.
  //   3. server-fetched o.status — the SSR baseline before either updates.
  const visibleOrders = orders
    .filter((o) => !removedIds.has(o.id))
    .map((o) => ({
      ...o,
      status: localStatuses[o.id] ?? panelOrders[o.id]?.status ?? o.status,
    }))

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
            <OrderIdentity restaurantName={order.restaurantName} id={order.id} />
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
              conversationId={order.conversationId}
              onStatusChange={(status) => handleStatusChange(order.id, status)}
            />
          </div>
        </article>
      ))}
    </div>
  )
}

