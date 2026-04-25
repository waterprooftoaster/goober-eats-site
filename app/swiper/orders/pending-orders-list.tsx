'use client'

/**
 * @file pending-orders-list.tsx
 * @description Swiper queue: open-order list + detail modal + accept action.
 *   Accept state machine is "soft-disable, not optimistic" (master plan §10):
 *   200 → openPanel + green banner + remove row; 409 → red banner + remove
 *   row; 403/5xx → inline modal error, modal stays open. Detail surface uses
 *   the S03 <Modal> primitive (focus-trap + Escape + return-focus).
 *   Called by: app/swiper/orders/page.tsx
 * @dependencies components/chat-panel, components/order/order-card,
 *   components/order/screenshot-gallery, components/ui/{modal,button,surface}
 */

import { useState } from 'react'
import { useChatPanel } from '@/components/chat-panel'
import { OrderCard, formatDollars } from '@/components/order/order-card'
import { ScreenshotGallery } from '@/components/order/screenshot-gallery'
import { Modal, ModalContent, ModalTitle } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'

export type PendingOrder = {
  id: string
  total_cents: number
  restaurant_name: string
  cart_screenshot_urls: string[]
  created_at: string
}

interface Props {
  orders: PendingOrder[]
}

/**
 * Swiper queue with detail modal + accept action. Soft-disable state machine
 * (no optimistic transitions; money-moving — see master plan §10).
 * @param orders - Open unclaimed orders for the swiper's school, oldest first
 * @returns Queue list, with the detail modal mounted alongside
 * @called-by app/swiper/orders/page.tsx
 */
export function PendingOrdersList({ orders: initialOrders }: Props) {
  const [orders, setOrders] = useState<PendingOrder[]>(initialOrders)
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const { openPanel } = useChatPanel()

  async function handleAccept() {
    if (!selectedOrder || accepting) return
    setAccepting(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/accept`, { method: 'PATCH' })
      if (res.ok) {
        const acceptedId = selectedOrder.id
        const acceptedRestaurant = selectedOrder.restaurant_name
        setOrders((prev) => prev.filter((o) => o.id !== acceptedId))
        setSelectedOrder(null)
        openPanel(acceptedId, 'in_progress')
        setSuccessMsg(`Order accepted! Head to ${acceptedRestaurant} to start filling it.`)
        setTimeout(() => { setSuccessMsg(null) }, 5000)
      } else if (res.status === 409) {
        // Race: another swiper claimed it first. Drop the row + close the modal.
        setOrders((prev) => prev.filter((o) => o.id !== selectedOrder.id))
        setSelectedOrder(null)
        setError('That order was just accepted by another swiper.')
      } else {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Failed to accept order. Please try again.')
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setAccepting(false)
    }
  }

  /**
   * Opens the order detail modal for a given queue row; clears any
   * stale list-level error in the process.
   * @param order - The PendingOrder to display in the modal
   * @called-by PendingOrdersList (order-card click handler)
   */
  function handleOpen(order: PendingOrder) {
    setSelectedOrder(order)
    setError(null)
  }

  /**
   * Modal close handler: ignores `open=true` events (Radix Dialog can
   * fire onOpenChange in either direction) and clears both the
   * selected order and any in-modal error on close.
   * @param open - Radix Dialog's new open state
   * @called-by PendingOrdersList (Modal onOpenChange)
   */
  function handleClose(open: boolean) {
    if (open) return
    setSelectedOrder(null)
    setError(null)
  }

  return (
    <div data-testid="pending-orders-list">
      {successMsg && (
        <Surface
          tone="subtle"
          padding="sm"
          data-testid="swiper-accept-success-banner"
          role="status"
          className="mb-6 border border-primary/40 bg-primary/10 text-sm"
        >
          {successMsg}
        </Surface>
      )}

      {error && !selectedOrder && (
        <p
          role="alert"
          className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {orders.length === 0 ? (
        <p
          data-testid="swiper-orders-empty-state"
          className="py-12 text-sm text-muted-foreground"
        >
          No open orders at your school right now. Check back soon.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {orders.map((order) => (
            <li key={order.id}>
              <OrderCard order={order} onClick={() => handleOpen(order)} />
            </li>
          ))}
        </ul>
      )}

      <Modal open={selectedOrder !== null} onOpenChange={handleClose}>
        {selectedOrder && (
          <ModalContent
            data-testid="swiper-order-detail-modal"
            className="max-w-lg gap-5"
          >
            <ModalTitle className="pr-6 text-xl">
              {selectedOrder.restaurant_name}
            </ModalTitle>

            <ScreenshotGallery urls={selectedOrder.cart_screenshot_urls} />

            <div className="flex items-baseline justify-between border-t border-border pt-4">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-base font-semibold tabular-nums">
                {formatDollars(selectedOrder.total_cents)}
              </span>
            </div>

            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Double-check the subtotals in the screenshots match the total before accepting.
            </p>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handleAccept}
              disabled={accepting}
              data-testid="swiper-accept-button"
              className="w-full"
            >
              {accepting ? 'Accepting…' : 'Accept order'}
            </Button>
          </ModalContent>
        )}
      </Modal>
    </div>
  )
}
