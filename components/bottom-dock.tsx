'use client'

/**
 * @file bottom-dock.tsx
 * @description Mobile-only floating dock anchored above the viewport bottom.
 *   Renders the swiper-queue circle on the left and a "View N active orders"
 *   redirect pill on the right. Returns null on desktop — desktop uses the
 *   inline DesktopUploadDock on the upload page only.
 *   Called by: app/layout.tsx
 * @dependencies @/components/swiper-orders-button, @/components/chat-panel,
 *   @/hooks/use-mobile
 */

import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { SwiperOrdersButton } from '@/components/swiper-orders-button'
import { useChatPanel } from '@/components/chat-panel'
import { useIsMobile } from '@/hooks/use-mobile'

interface BottomDockProps {
  isSwiper: boolean
  pendingOrderCount: number
}

/**
 * Floating mobile bottom row: swiper button + redirect pill to /current-orders.
 * @param isSwiper - Whether the principal is an authenticated swiper
 * @param pendingOrderCount - Count for the swiper-queue badge
 * @returns Floating row, or null on desktop / when nothing to show
 * @called-by app/layout.tsx
 */
export function BottomDock({ isSwiper, pendingOrderCount }: BottomDockProps) {
  const isMobile = useIsMobile()
  const { orders } = useChatPanel()
  const panelCount = Object.keys(orders).length

  if (!isMobile) return null
  if (!isSwiper && panelCount === 0) return null

  const pillLabel = panelCount === 1 ? 'View 1 active order' : `View ${panelCount} active orders`

  return (
    <div
      data-testid="bottom-dock"
      className="pointer-events-none fixed inset-x-6 bottom-3 z-40 flex items-stretch gap-2 pb-[env(safe-area-inset-bottom)]"
    >
      {isSwiper && (
        <div className="pointer-events-auto flex-shrink-0">
          <SwiperOrdersButton isSwiper={isSwiper} pendingOrderCount={pendingOrderCount} />
        </div>
      )}
      {panelCount > 0 && (
        <Link
          href="/current-orders"
          data-testid="chat-panel-header"
          className="pointer-events-auto flex h-12 min-w-0 flex-1 items-center justify-between gap-2 rounded-full bg-foreground/95 px-5 text-sm font-medium text-background shadow-lg backdrop-blur-md transition-colors hover:bg-foreground/90"
        >
          <span className="truncate">{pillLabel}</span>
          <MessageSquare className="h-4 w-4 flex-shrink-0" aria-hidden />
        </Link>
      )}
    </div>
  )
}
