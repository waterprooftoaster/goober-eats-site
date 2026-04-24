'use client'

/**
 * @file pending-orders-list.tsx
 * @description Client component displaying the swiper's open order queue with a detail modal and accept action.
 *   Called by: app/swiper/orders/page.tsx
 * @dependencies components/chat-panel.tsx, components/order/order-card.tsx, components/order/screenshot-gallery.tsx
 */

import { useState } from 'react'
import { useChatPanel } from '@/components/chat-panel'
import { OrderCard, formatDollars } from '@/components/order/order-card'
import { ScreenshotGallery } from '@/components/order/screenshot-gallery'

export type PendingOrder = {
  id: string
  total_cents: number
  restaurant_name: string
  cart_screenshot_urls: string[]
  created_at: string
}

type Props = {
  orders: PendingOrder[]
}

/**
 * Renders the list of open orders with per-order detail modal and accept button for swipers.
 * @param orders - Initial list of open unclaimed orders from the server
 * @returns Order list with expandable detail modal; updates in place on accept or race-condition failure
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
        setOrders((prev) => prev.filter((o) => o.id !== acceptedId))
        setSelectedOrder(null)
        openPanel(acceptedId, 'in_progress')
        setSuccessMsg(`Order accepted! Head to ${selectedOrder.restaurant_name} to start filling it.`)
        setTimeout(() => { setSuccessMsg(null) }, 5000)
      } else if (res.status === 409) {
        // Race condition — another swiper got there first
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

  return (
    <div data-testid="pending-orders-list">
      {successMsg && (
        <div data-testid="swiper-accept-success-banner" className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {successMsg}
        </div>
      )}
      {error && !selectedOrder && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <p data-testid="swiper-orders-empty-state" className="text-sm text-gray-500 py-8 text-center">
          No open orders at your school right now. Check back soon.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {orders.map((order) => (
            <li key={order.id}>
              <OrderCard
                order={order}
                onClick={() => { setSelectedOrder(order); setError(null) }}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Order Detail Dialog */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-end md:items-center justify-center">
          <div data-testid="swiper-order-detail-modal" className="bg-white rounded-t-lg md:rounded-lg w-full md:max-w-md md:mx-4 p-6 z-50 relative">
            <button
              onClick={() => { setSelectedOrder(null); setError(null) }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-lg leading-none"
              aria-label="Close"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold mb-4 pr-8">
              {selectedOrder.restaurant_name}
            </h2>

            <div className="mb-4">
              <ScreenshotGallery urls={selectedOrder.cart_screenshot_urls} />
            </div>

            <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-3 mb-3">
              <span>Total</span>
              <span className="text-base">{formatDollars(selectedOrder.total_cents)}</span>
            </div>

            <div className="mb-5 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              Double-check the subtotals in the screenshots match the total before accepting.
            </div>

            {error && (
              <p className="text-sm text-red-600 mb-3">{error}</p>
            )}

            <button
              onClick={handleAccept}
              disabled={accepting}
              data-testid="swiper-accept-button"
              className="w-full rounded-md bg-black px-4 py-3 text-white font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {accepting ? 'Accepting…' : 'Accept Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
