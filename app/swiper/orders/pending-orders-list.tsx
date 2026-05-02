'use client'

/**
 * @file pending-orders-list.tsx
 * @description Swiper queue: open-order list + detail modal + accept action.
 *   Accept state machine is "soft-disable, not optimistic" (master plan §10):
 *   200 → hard redirect to /current-orders; 409 → red banner + remove row;
 *   403/5xx → inline modal error, modal stays open. Detail surface uses the
 *   S03 <Modal> primitive (focus-trap + Escape + return-focus).
 *   Called by: app/swiper/orders/page.tsx
 * @dependencies components/order/order-card, components/order/cart-screenshot,
 *   components/ui/{modal,button}
 */

import { useState } from 'react'
import { OrderCard, formatDollars } from '@/components/order/order-card'
import { CartScreenshot } from '@/components/order/cart-screenshot'
import { Modal, ModalContent, ModalTitle, ModalDescription } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { computeSplit } from '@/lib/pricing'
import { useSwiperQueue } from '@/hooks/use-swiper-queue'

export type PendingOrder = {
  id: string
  subtotal_cents: number
  restaurant_name: string
  cart_screenshot_urls: string[]
  created_at: string
}

interface Props {
  orders: PendingOrder[]
  schoolId: string
}

/**
 * Swiper queue with detail modal + accept action. Soft-disable state machine
 * (no optimistic transitions; money-moving — see master plan §10). Live queue
 * updates come from useSwiperQueue (Realtime + visibility refetch).
 * @param orders - Open unclaimed orders for the swiper's school, oldest first (server-rendered initial)
 * @param schoolId - The swiper's school UUID; drives the realtime subscription
 * @returns Queue list, with the detail modal mounted alongside
 * @called-by app/swiper/orders/page.tsx
 */
export function PendingOrdersList({ orders: initialOrders, schoolId }: Props) {
  const { orders, removeOrder } = useSwiperQueue({ schoolId, initialOrders })
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept() {
    if (!selectedOrder || accepting) return
    setAccepting(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/accept`, { method: 'PATCH' })
      if (res.ok) {
        // Hard redirect (not router.push) so the destination page renders
        // from a fresh document load — no race with stale queue state.
        window.location.assign('/current-orders')
        return
      } else if (res.status === 409) {
        // Race: another swiper claimed it first. Drop the row + close the modal.
        removeOrder(selectedOrder.id)
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
            className="w-[calc(100vw-24px)] gap-4 sm:w-full sm:max-w-md"
          >
            <ModalTitle className="pr-6 text-xl">
              {selectedOrder.restaurant_name}
            </ModalTitle>
            <ModalDescription className="sr-only">
              Review the cart screenshot and total for this order before accepting.
            </ModalDescription>

            {selectedOrder.cart_screenshot_urls[0] && (
              <CartScreenshot
                src={selectedOrder.cart_screenshot_urls[0]}
                alt="Cart screenshot"
                testid="swiper-order-screenshot"
              />
            )}

            <div className="flex flex-col gap-1.5 border-t border-border pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">GrubHub subtotal</span>
                <span
                  className="text-base font-semibold tabular-nums"
                  data-testid="swiper-order-subtotal"
                >
                  {formatDollars(selectedOrder.subtotal_cents)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">You earn</span>
                <span
                  className="text-base font-semibold tabular-nums text-primary"
                  data-testid="swiper-order-earnings"
                >
                  {formatDollars(computeSplit(selectedOrder.subtotal_cents).swiperReceivesCents)}
                </span>
              </div>
            </div>

            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Double-check the subtotals in the screenshots match the GrubHub subtotal before accepting.
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
