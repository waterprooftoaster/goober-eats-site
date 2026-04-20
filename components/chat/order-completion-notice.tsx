/**
 * @file order-completion-notice.tsx
 * @description Completion view showing the delivery photo (if any) and a completion label.
 *   Called by: components/chat/chat-view.tsx (when order status is 'completed')
 */

import Image from 'next/image'
import type { Message } from '@/lib/types/messaging'

interface Props {
  deliveryPhoto: Message | null
  label?: string
}

/**
 * Renders the delivery photo (if present) and a completion label inside the chat panel.
 * @param deliveryPhoto - The delivery photo message, or null if no photo was attached
 * @param label - Text shown below the photo; defaults to 'Your order is ready!'
 * @called-by components/chat/chat-view.tsx
 */
export function OrderCompletedView({ deliveryPhoto, label = 'Your order is ready!' }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
      {deliveryPhoto?.image_url && (
        <a
          href={deliveryPhoto.image_url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block w-full h-48"
        >
          <Image
            fill
            src={deliveryPhoto.image_url}
            alt="Delivery photo"
            className="rounded-lg object-cover border border-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
          />
        </a>
      )}
      <p className="text-lg font-semibold text-gray-900">{label}</p>
    </div>
  )
}
