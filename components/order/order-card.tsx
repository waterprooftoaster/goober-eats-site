/**
 * @file order-card.tsx
 * @description List-item card for a pending swiper order showing restaurant,
 *   GrubHub subtotal (= the bill the swiper will cover), thumbnail, and age.
 *   Called by: app/swiper/orders/pending-orders-list.tsx
 */

'use client'

import Image from 'next/image'

export interface OrderSummary {
  id: string
  restaurant_name: string
  subtotal_cents: number
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
    <button
      type="button"
      data-testid="order-card"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-4 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none"
    >
      {thumbnail && (
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted/40">
          <Image src={thumbnail} alt={order.restaurant_name} fill className="object-cover" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{order.restaurant_name}</p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums">{formatDollars(order.subtotal_cents)}</p>
        <p className="text-xs text-muted-foreground">{timeAgo(order.created_at)}</p>
      </div>
    </button>
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
