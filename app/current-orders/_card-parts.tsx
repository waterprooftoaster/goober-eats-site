/**
 * @file _card-parts.tsx
 * @description Small chrome pieces used by the current-orders list: the order
 *   identity row (restaurant name + short id) and the status pill.
 *   Called by: app/current-orders/current-orders-list.tsx
 * @dependencies lib/utils, lib/types/database
 */

import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/lib/types/database'

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
 * Renders the order status as a tinted rounded badge.
 * @param status - The current order status
 * @called-by current-orders-list.tsx
 */
export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      data-testid="current-orders-status-badge"
      data-status={status}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        STATUS_TONE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

interface OrderIdentityProps {
  restaurantName: string
  id: string
}

/**
 * Renders an order's title row: restaurant name (truncated, falling back to
 * "Order") and the short eight-character id. The wrapping flex layout is part
 * of the identity unit; container chrome (border, padding, link/article) lives
 * on the caller.
 * @param restaurantName - Restaurant display name; empty string falls back to "Order"
 * @param id - Order UUID; only the first eight chars are shown
 * @called-by current-orders-list.tsx
 */
export function OrderIdentity({ restaurantName, id }: OrderIdentityProps) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="truncate text-sm font-semibold text-foreground">
        {restaurantName || 'Order'}
      </span>
      <span className="text-xs text-muted-foreground">
        #{id.slice(0, 8)}
      </span>
    </div>
  )
}
