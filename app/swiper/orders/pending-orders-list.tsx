'use client'

/**
 * @file pending-orders-list.tsx
 * @description Client component displaying the swiper's open order queue with a detail modal and accept action.
 *   Called by: app/swiper/orders/page.tsx
 * @dependencies components/chat-panel.tsx
 */

import { useState } from 'react'
import { useChatPanel } from '@/components/chat-panel'
import type { OrderItem } from '@/lib/types/database'

type EateryRef = { id: string; name: string } | null

export type PendingOrder = {
  id: string
  total_cents: number
  tip_cents: number
  items: OrderItem[]
  special_instructions: string | null
  created_at: string
  eateries: EateryRef
}

type Props = {
  orders: PendingOrder[]
}

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Converts an ISO timestamp to a human-readable relative time string (e.g. "5m ago", "2h ago").
 * @param iso - ISO 8601 timestamp string
 * @returns Relative time label
 */
function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/**
 * Renders the list of open orders with per-item detail modal and accept button for swipers.
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
    const res = await fetch(`/api/orders/${selectedOrder.id}/accept`, { method: 'PATCH' })
    setAccepting(false)
    if (res.ok) {
      const acceptedId = selectedOrder.id
      setOrders((prev) => prev.filter((o) => o.id !== acceptedId))
      setSelectedOrder(null)
      openPanel(acceptedId, 'in_progress')
      const name = selectedOrder.eateries?.name ?? 'the eatery'
      setSuccessMsg(`Order accepted! Head to ${name} to start filling it.`)
      setTimeout(() => { setSuccessMsg(null) }, 5000)
    } else if (res.status === 409) {
      // Race condition — another swiper got there first
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
          {orders.map((order) => {
            const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0)
            return (
              <li
                key={order.id}
                onClick={() => { setSelectedOrder(order); setError(null) }}
                className="py-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 rounded-lg px-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{order.eateries?.name ?? '—'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{formatDollars(order.total_cents)}</p>
                  <p className="text-xs text-gray-400">{timeAgo(order.created_at)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Order Detail Dialog */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-end md:items-center justify-center">
          <div className="bg-white rounded-t-lg md:rounded-lg w-full md:max-w-md md:mx-4 p-6 z-50 relative">
            {/* Close */}
            <button
              onClick={() => { setSelectedOrder(null); setError(null) }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-lg leading-none"
              aria-label="Close"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold mb-4 pr-8">
              {selectedOrder.eateries?.name ?? 'Order'}
            </h2>

            {/* Items */}
            <ul className="space-y-1 mb-4">
              {selectedOrder.items.map((item, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span>
                    {item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name}
                  </span>
                  <span className="text-gray-500 ml-4 shrink-0">
                    {formatDollars(item.price_cents * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Special instructions */}
            {selectedOrder.special_instructions && (
              <p className="text-xs text-gray-500 italic mb-4 border-t border-gray-100 pt-3">
                Note: {selectedOrder.special_instructions}
              </p>
            )}

            <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-3 mb-5">
              <span>Total</span>
              <span>{formatDollars(selectedOrder.total_cents)}</span>
            </div>

            {error && (
              <p className="text-sm text-red-600 mb-3">{error}</p>
            )}

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
