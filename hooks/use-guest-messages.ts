'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Conversation, Message } from '@/lib/types/messaging'
import type { OrderStatus } from '@/lib/types/database'

const POLL_INTERVAL_MS = 5000
const TERMINAL_STATUSES: OrderStatus[] = ['completed', 'cancelled']

interface UseGuestMessagesResult {
  messages: Message[]
  conversation: Conversation | null
  orderStatus: OrderStatus
  isLoading: boolean
  error: string | null
  sendMessage: (body: string) => Promise<void>
}

export function useGuestMessages(
  orderId: string | null,
  initialOrderStatus: OrderStatus
): UseGuestMessagesResult {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(initialOrderStatus)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Track terminal state via ref so the interval callback always sees the latest value
  const isTerminalRef = useRef(TERMINAL_STATUSES.includes(initialOrderStatus))

  // Initial fetch + polling
  useEffect(() => {
    if (!orderId) {
      setMessages([])
      setConversation(null)
      setOrderStatus(initialOrderStatus)
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    async function fetchMessages() {
      try {
        const res = await fetch(`/api/guest/messages/${orderId}`)
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          if (!cancelled) setError(json.error ?? 'Failed to load messages')
          return
        }
        const data: {
          conversation: Conversation | null
          messages: Message[]
          order_status: OrderStatus | null
        } = await res.json()
        if (cancelled) return
        setConversation(data.conversation)
        setMessages(data.messages)
        if (data.order_status) {
          setOrderStatus(data.order_status)
          isTerminalRef.current = TERMINAL_STATUSES.includes(data.order_status)
        }
      } catch {
        if (!cancelled) setError('Network error — please refresh')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchMessages()

    // Stop polling immediately if already terminal on mount
    if (TERMINAL_STATUSES.includes(initialOrderStatus)) return () => { cancelled = true }

    const intervalId = setInterval(() => {
      if (!cancelled && !isTerminalRef.current) fetchMessages()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [orderId, initialOrderStatus])

  const sendMessage = useCallback(
    async (body: string) => {
      const res = await fetch('/api/guest/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, body, message_type: 'text' }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Failed to send message')
      }
    },
    [orderId]
  )

  return { messages, conversation, orderStatus, isLoading, error, sendMessage }
}
