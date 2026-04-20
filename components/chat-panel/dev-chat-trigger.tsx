'use client'

/**
 * @file dev-chat-trigger.tsx
 * @description Development-only button that manually opens a chat panel for a given order.
 *   Called by: (development use only)
 */

// TODO: Replace with real checkout trigger — call openPanel(orderId, status) after
// a successful order creation response from /api/stripe/checkout-session or equivalent.
import { useChatPanel } from './chat-panel-context'
import type { OrderStatus } from '@/lib/types/database'

interface Props {
  orderId: string
  status: OrderStatus
}

/**
 * Renders a small "Chat" button that calls openPanel to open the chat panel for the given order.
 * @param orderId - UUID of the order to open
 * @param status - Initial status to pass to the chat panel
 * @called-by (development use only)
 */
export function DevChatTrigger({ orderId, status }: Props) {
  const { openPanel } = useChatPanel()
  return (
    <button
      onClick={() => openPanel(orderId, status)}
      className="rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700"
    >
      Chat
    </button>
  )
}
