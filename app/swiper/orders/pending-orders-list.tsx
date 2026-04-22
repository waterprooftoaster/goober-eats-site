'use client'

/**
 * @file pending-orders-list.tsx
 * @description Client component displaying the swiper's open order queue with a
 *   detail modal and accept action. Post-pivot: each order carries
 *   restaurant_name + cart_screenshot_urls instead of structured menu items.
 *   Called by: app/swiper/orders/page.tsx
 * @dependencies components/chat-panel
 */

import { useState } from 'react'
import Image from 'next/image'
import { useChatPanel } from '@/components/chat-panel'

export type PendingOrder = {
  id: string
  restaurant_name: string
  total_cents: number
  tip_cents: number
  special_instructions: string | null
  cart_screenshot_urls: string[]
  created_at: string
}

interface Props {
  orders: PendingOrder[]
}

/**
 * Renders the list of open orders with per-order detail modal and accept
 * button for swipers. Handles race-condition 409s on accept by dropping the
 * affected row from the list.
 * @param orders - Initial list of open unclaimed orders from the server
 * @returns Order list with expandable detail modal
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
    const res = await fetch(`/api/orders/${selectedOrder.id}/accept`, { method: 'PATCH' })
    setAccepting(false)
    if (res.ok) {
      const acceptedId = selectedOrder.id
      setOrders((prev) => prev.filter((o) => o.id !== acceptedId))
      setSelectedOrder(null)
      openPanel(acceptedId, 'in_progress')
      setSuccessMsg(`Order accepted! Head to ${selectedOrder.restaurant_name} to start filling it.`)
      setTimeout(() => { setSuccessMsg(null) }, 5000)
    } else if (res.status === 409) {
      setOrders((prev) => prev.filter((o) => o.id !== selectedOrder.id))
      setSelectedOrder(null)
      setError('That order was just accepted by another swiper.')
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Failed to accept order. Please try again.')
    }
  }

  return (
    <div>
      {successMsg && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {successMsg}
        </div>
      )}
      {error && !selectedOrder && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No open orders at your school right now. Check back soon.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {orders.map((order) => (
            <li
              key={order.id}
              onClick={() => { setSelectedOrder(order); setError(null) }}
              className="py-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 rounded-lg px-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{order.restaurant_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {order.cart_screenshot_urls.length} screenshot
                  {order.cart_screenshot_urls.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold">{formatDollars(order.total_cents)}</p>
                <p className="text-xs text-gray-400">{timeAgo(order.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-end md:items-center justify-center">
          <div className="bg-white rounded-t-lg md:rounded-lg w-full md:max-w-md md:mx-4 p-6 z-50 relative">
            <button
              onClick={() => { setSelectedOrder(null); setError(null) }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-lg leading-none"
              aria-label="Close"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold mb-4 pr-8">{selectedOrder.restaurant_name}</h2>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {selectedOrder.cart_screenshot_urls.map((path, i) => (
                <div key={i} className="relative aspect-[4/5] overflow-hidden rounded-md border border-gray-100">
                  <Image
                    src={path}
                    alt={`Cart screenshot ${i + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ))}
            </div>

            {selectedOrder.special_instructions && (
              <p className="text-xs text-gray-500 italic mb-4 border-t border-gray-100 pt-3">
                Note: {selectedOrder.special_instructions}
              </p>
            )}

            <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-3 mb-5">
              <span>Total</span>
              <span>{formatDollars(selectedOrder.total_cents)}</span>
            </div>

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            <button
              onClick={handleAccept}
              disabled={accepting}
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

// --- Helpers ---

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Converts an ISO timestamp to a human-readable relative time string.
 * @param iso - ISO 8601 timestamp string
 * @returns Relative time label like "5m ago" or "2h ago"
 */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
