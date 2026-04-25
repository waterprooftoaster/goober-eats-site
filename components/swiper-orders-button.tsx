'use client'

/**
 * @file swiper-orders-button.tsx
 * @description Fixed bottom-left floating button linking to /swiper/orders with a
 *   pending-order badge. Visible only for authenticated swipers (isSwiper prop
 *   gates render). Brand voice (.impeccable.md principle 2 — "the accent earns
 *   its place"): the button itself is on the foreground neutral, lime accent
 *   only on the badge dot.
 *   Called by: app/layout.tsx
 */

import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SwiperOrdersButtonProps {
  isSwiper: boolean
  pendingOrderCount: number
}

/**
 * Renders the floating swiper queue affordance with a pending-order badge.
 * @param isSwiper - Render gate; null short-circuit for non-swipers
 * @param pendingOrderCount - Server-rendered count for the swiper's school
 * @returns Floating link or null
 * @called-by app/layout.tsx
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
      className={cn(
        'fixed bottom-6 left-6 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-colors',
        'hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
      )}
    >
      <ClipboardList className="h-5 w-5" aria-hidden />
      {showBadge && (
        <span
          data-testid="swiper-orders-badge"
          aria-hidden
          className={cn(
            'absolute -top-1 -right-1 inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground shadow-sm ring-2 ring-background'
          )}
        >
          {badgeLabel}
        </span>
      )}
    </Link>
  )
}
