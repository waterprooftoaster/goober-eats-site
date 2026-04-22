/**
 * @file order-card.tsx
 * @description List-item card for a pending swiper order showing restaurant, total, thumbnail, and age.
 *   Called by: app/swiper/orders/pending-orders-list.tsx
 */

'use client'

import Image from 'next/image'

export interface OrderSummary {
  id: string
  restaurant_name: string
  total_cents: number
  cart_screenshot_urls: string[]
  created_at: string
}

interface OrderCardProps {
  order: OrderSummary
  onClick: () => void
}

/**
 * Renders a single swiper order card with restaurant name, formatted total, first screenshot thumbnail, and age.
 * @param order - OrderSummary containing the display fields
 * @param onClick - Called when the card is clicked
 * @called-by app/swiper/orders/pending-orders-list.tsx
 */
export function OrderCard({ order, onClick }: OrderCardProps) {
  const thumbnail = order.cart_screenshot_urls[0] ?? null

  return (
    <div
      data-testid="order-card"
      onClick={onClick}
      className="flex items-center gap-3 py-4 px-2 cursor-pointer hover:bg-gray-50 rounded-lg"
    >
      {thumbnail && (
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
          <Image src={thumbnail} alt={order.restaurant_name} fill className="object-cover" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{order.restaurant_name}</p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-semibold">{formatDollars(order.total_cents)}</p>
        <p className="text-xs text-gray-400">{timeAgo(order.created_at)}</p>
      </div>
    </div>
  )
}

// --- Helpers ---

/**
 * Formats an integer cents value as a dollar string.
 * @param cents - Amount in integer cents
 * @returns Formatted string like "$12.50"
 */
export function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Converts an ISO timestamp to a human-readable relative time string.
 * @param iso - ISO 8601 timestamp
 * @returns Relative label like "5m ago" or "2h ago"
 */
export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
