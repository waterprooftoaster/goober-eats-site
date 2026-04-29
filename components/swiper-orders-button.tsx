'use client'

/**
 * @file swiper-orders-button.tsx
 * @description Inline circular link to /swiper/orders with a pending-order
 *   badge. Slotted by components/bottom-dock.tsx; not mounted directly anywhere
 *   else.
 *   Called by: components/bottom-dock.tsx
 */

import Link from 'next/link'
import { ClipboardList } from 'lucide-react'

interface SwiperOrdersButtonProps {
  isSwiper: boolean
  pendingOrderCount: number
}

/**
 * Renders the circular swiper-queue affordance with a pending-order badge.
 * @param isSwiper - Render gate; null short-circuit for non-swipers
 * @param pendingOrderCount - Server-rendered count for the swiper's school
 * @returns Link or null
 * @called-by components/bottom-dock.tsx
 */
export function SwiperOrdersButton({ isSwiper, pendingOrderCount }: SwiperOrdersButtonProps) {
  if (!isSwiper) return null

  const showBadge = pendingOrderCount > 0
  const badgeLabel = pendingOrderCount > 99 ? '99+' : String(pendingOrderCount)

  return (
    <Link
      href="/swiper/orders"
      data-testid="swiper-orders-button"
      aria-label={
        showBadge
          ? `Open swiper queue (${pendingOrderCount} pending)`
          : 'Open swiper queue'
      }
      className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <ClipboardList className="h-5 w-5" aria-hidden />
      {showBadge && (
        <span
          data-testid="swiper-orders-badge"
          aria-hidden
          className="absolute -top-1 -right-1 inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground shadow-sm ring-2 ring-background"
        >
          {badgeLabel}
        </span>
      )}
    </Link>
  )
}
