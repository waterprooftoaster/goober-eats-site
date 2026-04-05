'use client'

import { useEffect, useRef } from 'react'
import { useMessages } from '@/hooks/use-messages'
import { useGuestMessages } from '@/hooks/use-guest-messages'
import { ChatThread } from '@/components/chat/chat-thread'
import { ChatInput } from '@/components/chat/chat-input'
import { CompletionBanner } from '@/components/chat/completion-banner'
import { OrderCompletedView } from '@/components/chat/order-completion-notice'
import type { Conversation, Message } from '@/lib/types/messaging'
import type { OrderStatus } from '@/lib/types/database'

const CLOSED_STATUSES: OrderStatus[] = ['completed', 'cancelled']

// ---------------------------------------------------------------------------
// Shared rendering core — no hooks
// ---------------------------------------------------------------------------

interface CoreProps {
  orderId: string
  messages: Message[]
  conversation: Conversation | null
  currentUserId: string | null
  orderStatus: OrderStatus
  isLoading: boolean
  error: string | null
  sendMessage: (body: string) => Promise<void>
  onStatusChange?: (status: OrderStatus) => void
  onClose?: () => void
}

function ChatViewCore({
  orderId,
  messages,
  conversation,
  currentUserId,
  orderStatus,
  isLoading,
  error,
  sendMessage,
  onStatusChange,
  onClose,
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
    return <OrderCompletedView deliveryPhoto={deliveryPhoto} onClose={onClose ?? (() => {})} />
  }

  return (
    <div className="flex h-full flex-col">
      {conversation ? (
        <>
          <p className="px-4 py-2 text-xs text-gray-500 italic border-b border-gray-100">
            {currentUserId === null || currentUserId === conversation.orderer_id
              ? 'Type here to contact your swiper.'
              : 'Contact the orderer in this chat.'}
          </p>
          <ChatThread
            messages={messages}
            conversation={conversation}
            currentUserId={currentUserId}
            messagesEndRef={messagesEndRef}
          />
        </>
      ) : currentUserId === null ? (
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="text-center">
            <p className="text-lg font-medium text-gray-900">Looking for a swiper…</p>
            <p className="mt-2 text-sm text-gray-500">
              You&apos;ll be able to chat once a swiper accepts your order.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}
      {currentUserId !== null &&
        currentUserId === conversation?.swiper_id &&
        orderStatus === 'in_progress' && (
          <CompletionBanner orderId={orderId} onStatusChange={onStatusChange} />
        )}
      <ChatInput orderId={orderId} onSend={sendMessage} disabled={isClosed || !conversation} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Auth branch — uses Supabase Realtime via useMessages
// ---------------------------------------------------------------------------

interface AuthChatContentProps {
  orderId: string
  currentUserId: string
  orderStatus: OrderStatus
  onStatusChange?: (status: OrderStatus) => void
  onClose?: () => void
}

function AuthChatContent({ orderId, currentUserId, orderStatus, onStatusChange, onClose }: AuthChatContentProps) {
  const { messages, conversation, isLoading, error, sendMessage } = useMessages(orderId)
  return (
    <ChatViewCore
      orderId={orderId}
      messages={messages}
      conversation={conversation}
      currentUserId={currentUserId}
      orderStatus={orderStatus}
      isLoading={isLoading}
      error={error}
      sendMessage={sendMessage}
      onStatusChange={onStatusChange}
      onClose={onClose}
    />
  )
}

// ---------------------------------------------------------------------------
// Guest branch — uses polling via useGuestMessages; notifies panel on status change
// ---------------------------------------------------------------------------

interface GuestChatContentProps {
  orderId: string
  initialOrderStatus: OrderStatus
  onStatusChange?: (status: OrderStatus) => void
  onClose?: () => void
}

function GuestChatContent({ orderId, initialOrderStatus, onStatusChange, onClose }: GuestChatContentProps) {
  const { messages, conversation, orderStatus, isLoading, error, sendMessage } =
    useGuestMessages(orderId, initialOrderStatus)

  const prevStatus = useRef(initialOrderStatus)
  useEffect(() => {
    if (orderStatus !== prevStatus.current) {
      prevStatus.current = orderStatus
      onStatusChange?.(orderStatus)
    }
  }, [orderStatus, onStatusChange])

  return (
    <ChatViewCore
      orderId={orderId}
      messages={messages}
      conversation={conversation}
      currentUserId={null}
      orderStatus={orderStatus}
      isLoading={isLoading}
      error={error}
      sendMessage={sendMessage}
      onClose={onClose}
    />
  )
}

// ---------------------------------------------------------------------------
// Public API — dispatches to the right branch based on currentUserId
// ---------------------------------------------------------------------------

interface Props {
  orderId: string
  currentUserId: string | null
  orderStatus: OrderStatus
  onStatusChange?: (status: OrderStatus) => void
  onClose?: () => void
}

export function ChatView({ orderId, currentUserId, orderStatus, onStatusChange, onClose }: Props) {
  if (currentUserId !== null) {
    return (
      <AuthChatContent
        orderId={orderId}
        currentUserId={currentUserId}
        orderStatus={orderStatus}
        onStatusChange={onStatusChange}
        onClose={onClose}
      />
    )
  }
  return (
    <GuestChatContent
      orderId={orderId}
      initialOrderStatus={orderStatus}
      onStatusChange={onStatusChange}
      onClose={onClose}
    />
  )
}
