/**
 * @file cart-screenshot.tsx
 * @description Locked-size render container for cart screenshots and
 *   completion photos. Width is fixed per viewport (280/320/360 phone/tablet/
 *   desktop) at a canonical 9:16 aspect; the inner <img> uses object-contain
 *   so any in-band aspect ratio (square ⇄ tall phone) renders at consistent
 *   on-screen size. Out-of-band uploads are rejected at upload time
 *   (lib/image/normalize.ts), so this component never has to handle landscape,
 *   panorama, or tablet 4:3 inputs.
 *   Called by: app/swiper/orders/pending-orders-list.tsx,
 *   app/checkout/page.tsx, components/home-upload.tsx,
 *   components/chat/order-completion-notice.tsx
 * @dependencies lib/utils (cn)
 */

import { cn } from '@/lib/utils'

interface CartScreenshotProps {
  src: string
  alt: string
  testid?: string
  className?: string
}

// Explicit width AND height (instead of aspect-[9/16]) — Safari collapses
// aspect-ratio elements to 0 height when they're flex children whose sole
// content is absolutely positioned (the <img inset-0> below). shrink-0
// guards the same flex-shrink bug for ancestors that don't fully resolve.
// Heights are width × 16/9: 280→498, 320→569, 360→640.
const BOX = 'mx-auto shrink-0 w-[280px] h-[498px] sm:w-[320px] sm:h-[569px] lg:w-[360px] lg:h-[640px] overflow-hidden rounded-lg border border-border'

/**
 * Renders a cart screenshot inside the locked-size container.
 * @param src - Image URL (signed Supabase Storage URL or object-URL preview)
 * @param alt - Alt text for accessibility
 * @param testid - Optional data-testid for the wrapping container
 * @param className - Optional accent classes (e.g., bg tone for empty state)
 * @returns The locked-size container with the image inside
 * @called-by render surfaces (swiper modal, checkout, home preview, completion view)
 */
export function CartScreenshot({ src, alt, testid, className }: CartScreenshotProps) {
  return (
    <div data-testid={testid} className={cn('relative bg-muted/40', BOX, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  )
}

/**
 * Loading-state placeholder matching CartScreenshot's exact dimensions so
 * the layout doesn't jump when the image lands.
 * @param testid - Optional data-testid for the placeholder element
 * @param className - Optional accent classes
 * @returns A pulsing placeholder at the locked container size
 * @called-by app/checkout/page.tsx, components/chat/order-completion-notice.tsx
 */
export function CartScreenshotSkeleton({ testid, className }: { testid?: string; className?: string }) {
  return (
    <div
      data-testid={testid}
      aria-label="Loading screenshot"
      role="status"
      className={cn('animate-pulse bg-muted motion-reduce:animate-none', BOX, className)}
    />
  )
}
