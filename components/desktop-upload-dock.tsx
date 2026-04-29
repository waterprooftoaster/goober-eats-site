'use client'

/**
 * @file desktop-upload-dock.tsx
 * @description Desktop-only inline dock slotted into the upload page below the
 *   tips/place-order card. Width-aligned to the upload column (`max-w-md`)
 *   so it matches the hero, dropzone, tips, and place-order button. Renders
 *   nothing on mobile (the floating mobile BottomDock owns that viewport).
 *   Called by: components/home-upload.tsx
 * @dependencies @/components/swiper-orders-button, @/components/chat-panel,
 *   @/hooks/use-mobile
 */

import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { SwiperOrdersButton } from '@/components/swiper-orders-button'
import { useChatPanel } from '@/components/chat-panel'
import { useIsMobile } from '@/hooks/use-mobile'

interface DesktopUploadDockProps {
  isSwiper: boolean
  pendingOrderCount: number
}

/**
 * Inline desktop dock for the upload page.
 * @param isSwiper - Whether the principal is an authenticated swiper
 * @param pendingOrderCount - Count for the swiper-queue badge
 * @returns Inline row constrained to max-w-md, or null on mobile / nothing-to-show
 * @called-by components/home-upload.tsx
 */
export function DesktopUploadDock({ isSwiper, pendingOrderCount }: DesktopUploadDockProps) {
  const isMobile = useIsMobile()
  const { orders } = useChatPanel()
  const panelCount = Object.keys(orders).length

  if (isMobile) return null
  if (!isSwiper && panelCount === 0) return null

  const pillLabel = panelCount === 1 ? 'View 1 active order' : `View ${panelCount} active orders`

  return (
    <div
      data-testid="desktop-upload-dock"
      className="flex w-full max-w-md items-stretch gap-2"
    >
      {isSwiper && (
        <div className="flex-shrink-0">
          <SwiperOrdersButton isSwiper={isSwiper} pendingOrderCount={pendingOrderCount} />
        </div>
      )}
      {panelCount > 0 && (
        <Link
          href="/current-orders"
          data-testid="chat-panel-header"
          className="flex h-12 min-w-0 flex-1 items-center justify-between gap-2 rounded-full bg-foreground/95 px-5 text-sm font-medium text-background shadow-lg backdrop-blur-md transition-colors hover:bg-foreground/90"
        >
          <span className="truncate">{pillLabel}</span>
          <MessageSquare className="h-4 w-4 flex-shrink-0" aria-hidden />
        </Link>
      )}
    </div>
  )
}
