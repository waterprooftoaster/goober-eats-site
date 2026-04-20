'use client'

/**
 * @file chat-view.tsx
 * @description Order chat UI with Realtime message subscription, status pseudo-messages, and completion UI.
 *   ChatViewCore is a hook-free rendering core shared by ChatView (public API).
 *   Called by: components/chat-panel/chat-panel.tsx, app/current-orders/current-orders-list.tsx
 * @dependencies hooks/use-messages.ts, components/chat/chat-thread.tsx, components/chat/chat-input.tsx
 */

import { useEffect, useRef } from 'react'
import { useMessages } from '@/hooks/use-messages'
import { ChatThread } from '@/components/chat/chat-thread'
import { ChatInput } from '@/components/chat/chat-input'
import { CompletionBanner } from '@/components/chat/completion-banner'
import { OrderCompletedView } from '@/components/chat/order-completion-notice'
import type { Conversation, Message } from '@/lib/types/messaging'
import type { OrderStatus } from '@/lib/types/database'

const CLOSED_STATUSES: OrderStatus[] = ['completed', 'cancelled']

interface CoreProps {
  orderId: string
  eateryName: string
  messages: Message[]
  conversation: Conversation | null
  currentUserId: string | null
  orderStatus: OrderStatus
  isLoading: boolean
  error: string | null
  sendMessage: (body: string) => Promise<void>
  onStatusChange?: (status: OrderStatus) => void
}

/**
 * Hook-free rendering core for the chat UI; handles all visual states (loading, error, completed, active).
 * @param orderId - UUID of the order this chat belongs to
 * @param eateryName - Eatery name used in the status pseudo-message
 * @param messages - Live message array from the Realtime subscription
 * @param conversation - Conversation row (null while the order is still open)
 * @param currentUserId - Authenticated user ID, or null for guests
 * @param orderStatus - Current order status used to determine which UI to show
 * @param isLoading - Whether the initial message fetch is in flight
 * @param error - Error message to display if the fetch failed
 * @param sendMessage - Async function to send a text message
 * @param onStatusChange - Optional callback invoked when the swiper changes the order status
 * @called-by ChatView
 */
function ChatViewCore({
  orderId,
  eateryName,
  messages,
  conversation,
  currentUserId,
  orderStatus,
  isLoading,
  error,
  sendMessage,
  onStatusChange,
}: CoreProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isClosed = CLOSED_STATUSES.includes(orderStatus)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    )
  }

  if (orderStatus === 'completed') {
    const deliveryPhoto =
      [...messages].reverse().find((m) => m.message_type === 'delivery_photo') ?? null
    const isSwiper = currentUserId !== null && currentUserId === conversation?.swiper_id
    return (
      <OrderCompletedView
        deliveryPhoto={deliveryPhoto}
        label={isSwiper ? 'Order Completed' : undefined}
      />
    )
  }

  const statusMessages = getStatusMessages(orderStatus, orderId, eateryName, conversation, currentUserId)

  return (
    <div className="flex h-full flex-col">
      <ChatThread
        pseudoMessages={statusMessages}
        messages={messages}
        currentUserId={currentUserId}
        messagesEndRef={messagesEndRef}
      />
      {currentUserId !== null &&
        currentUserId === conversation?.swiper_id &&
        orderStatus === 'in_progress' && (
          <CompletionBanner orderId={orderId} onStatusChange={onStatusChange} />
        )}
      <ChatInput orderId={orderId} onSend={sendMessage} disabled={isClosed || !conversation} />
    </div>
  )
}

interface Props {
  orderId: string
  eateryName: string
  currentUserId: string | null
  orderStatus: OrderStatus
  onStatusChange?: (status: OrderStatus) => void
}

/**
 * Subscribes to Realtime messages for the order and delegates rendering to ChatViewCore.
 * @param orderId - UUID of the order
 * @param eateryName - Eatery name for the status pseudo-message
 * @param currentUserId - Authenticated user ID, or null for guests
 * @param orderStatus - Current order status
 * @param onStatusChange - Optional callback when the swiper transitions the order status
 * @called-by components/chat-panel/chat-panel.tsx, app/current-orders/current-orders-list.tsx
 */
export function ChatView({ orderId, eateryName, currentUserId, orderStatus, onStatusChange }: Props) {
  const { messages, conversation, isLoading, error, sendMessage } = useMessages(orderId)
  return (
    <ChatViewCore
      orderId={orderId}
      eateryName={eateryName}
      messages={messages}
      conversation={conversation}
      currentUserId={currentUserId}
      orderStatus={orderStatus}
      isLoading={isLoading}
      error={error}
      sendMessage={sendMessage}
      onStatusChange={onStatusChange}
    />
  )
}

// --- Helpers ---

/**
 * Returns the ordered list of pinned status pseudo-message texts for the given role + state.
 * Orderers in in_progress see both the placed-order and preparing messages stacked.
 * @param orderStatus - Current order status
 * @param orderId - Full order UUID (sliced to 8 chars for display)
 * @param eateryName - Name of the eatery for the order
 * @param conversation - Current conversation row, or null if order is open
 * @param currentUserId - Authenticated user ID, or null for guests
 * @called-by ChatViewCore
 */
function getStatusMessages(
  orderStatus: OrderStatus,
  orderId: string,
  eateryName: string,
  conversation: Conversation | null,
  currentUserId: string | null
): string[] {
  const shortId = orderId.slice(0, 8)
  // conversation is null in 'open' state, so swiper_id check resolves to false
  const isSwiper = currentUserId !== null && currentUserId === conversation?.swiper_id
  const placedMsg = `You've successfully placed order #${shortId} at ${eateryName}! Hold tight while a swiper accepts your order.`

  if (orderStatus === 'open' && !isSwiper) {
    return [placedMsg]
  }
  if (orderStatus === 'in_progress' && !isSwiper) {
    const name = conversation?.swiper_full_name ?? 'Your swiper'
    return [placedMsg, `Swiper ${name} is preparing your order!`]
  }
  if (orderStatus === 'in_progress' && isSwiper) {
    return [`You've successfully accepted order #${shortId}! Take a picture of where you left the order to complete the order.`]
  }
  return []
}
