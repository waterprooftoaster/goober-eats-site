/**
 * @file swiper-orders-button.tsx
 * @description Fixed bottom-left floating button linking to /swiper/orders with a badge
 *   showing pending order count. Only renders for authenticated swipers.
 *   Called by: app/layout.tsx
 */

'use client'

import Link from 'next/link'
import { ClipboardList } from 'lucide-react'

interface SwiperOrdersButtonProps {
  isSwiper: boolean
  pendingOrderCount: number
}

/**
 * Renders a fixed floating button for swipers to access pending orders.
 * @param isSwiper - Whether the current user is an authenticated swiper
 * @param pendingOrderCount - Number of open orders to display in the badge
 * @returns null if the user is not a swiper
 * @called-by app/layout.tsx
 */
export function SwiperOrdersButton({ isSwiper, pendingOrderCount }: SwiperOrdersButtonProps) {
  if (!isSwiper) return null

  return (
    <Link
      href="/swiper/orders"
      className="fixed bottom-6 left-6 z-50 relative rounded-full bg-black p-3 text-white shadow-lg transition-colors hover:bg-black/80"
      aria-label="Swiper Orders"
      data-testid="swiper-orders-button"
    >
      <ClipboardList className="h-6 w-6" />
      {pendingOrderCount > 0 && (
        <span
          data-testid="swiper-orders-badge"
          className="absolute -top-1 -right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
        >
          {pendingOrderCount > 99 ? '99+' : pendingOrderCount}
        </span>
      )}
    </Link>
  )
}
