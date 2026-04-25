/**
 * @file order-completion-notice.tsx
 * @description Completion view showing the completion photo (if any) and a completion label.
 *   Called by: components/chat/chat-view.tsx (when order status is 'completed')
 */

import Image from 'next/image'
import type { Message } from '@/lib/types/messaging'

interface Props {
  deliveryPhoto: Message | null
  label?: string
}

/**
 * Renders the completion photo (if present) and a completion label inside the chat panel.
 * @param deliveryPhoto - The completion photo message, or null if no photo was attached
 * @param label - Text shown below the photo; defaults to 'Your order is ready!'
 * @called-by components/chat/chat-view.tsx
 */
export function OrderCompletedView({ deliveryPhoto, label = 'Your order is ready!' }: Props) {
  return (
    <div data-testid="order-completed-view" className="flex h-full flex-col items-center justify-center gap-4 p-4">
      {deliveryPhoto?.image_url && (
        <a
          href={deliveryPhoto.image_url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block h-48 w-full"
        >
          <Image
            fill
            src={deliveryPhoto.image_url}
            alt="Completion photo from your swiper"
            className="cursor-pointer rounded-lg border border-border object-cover transition-opacity hover:opacity-90 motion-reduce:transition-none"
          />
        </a>
      )}
      <p className="text-lg font-semibold text-foreground">{label}</p>
    </div>
  )
}
