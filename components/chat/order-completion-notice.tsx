/**
 * @file order-completion-notice.tsx
 * @description Completion view rendered inside the chat panel when the order
 *   reaches `completed`. Orderer view shows the photo only (with a loading
 *   skeleton until the photo INSERT arrives via realtime / refetch); swiper
 *   view shows the photo plus an "Order Completed" label.
 *   Called by: components/chat/chat-view.tsx
 */

import Image from 'next/image'
import type { Message } from '@/lib/types/messaging'

type ViewerRole = 'orderer' | 'swiper'

interface Props {
  viewerRole: ViewerRole
  deliveryPhoto: Message | null
}

/**
 * Renders the completion photo (or a loading skeleton when not yet available).
 * Adds the "Order Completed" label only for the swiper — the orderer's view is
 * intentionally label-free; the picture is the message.
 * @param viewerRole - Whether the current viewer is the orderer or the swiper
 * @param deliveryPhoto - The completion photo message, or null if it hasn't arrived yet
 * @called-by components/chat/chat-view.tsx
 */
export function OrderCompletedView({ viewerRole, deliveryPhoto }: Props) {
  const imageUrl = deliveryPhoto?.image_url ?? null
  const label = viewerRole === 'swiper' ? 'Order Completed' : 'Your Order is Ready!'
  return (
    <div data-testid="order-completed-view" className="flex h-full flex-col items-center justify-center gap-4 p-4">
      {imageUrl ? (
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block h-48 w-full"
        >
          <Image
            fill
            src={imageUrl}
            alt="Completion photo from your swiper"
            className="cursor-pointer rounded-lg border border-border object-cover transition-opacity hover:opacity-90 motion-reduce:transition-none"
          />
        </a>
      ) : (
        <div
          data-testid="order-completed-loading"
          aria-label="Loading completion photo"
          role="status"
          className="h-48 w-full animate-pulse rounded-lg border border-border bg-muted motion-reduce:animate-none"
        />
      )}
      <p className="text-lg font-semibold text-foreground">{label}</p>
    </div>
  )
}
