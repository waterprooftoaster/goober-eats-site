'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { messagesChannel } from '@/lib/constants'
import type { Conversation, Message } from '@/lib/types/messaging'

interface UseMessagesResult {
  messages: Message[]
  conversation: Conversation | null
  isLoading: boolean
  error: string | null
  sendMessage: (body: string) => Promise<void>
}

export function useMessages(orderId: string | null): UseMessagesResult {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initial fetch
  useEffect(() => {
    if (!orderId) {
      setMessages([])
      setConversation(null)
      setIsLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/messages/${orderId}`)
        if (res.status === 404) {
          // No conversation yet — expected for pending orders before a swiper connects
          return
        }
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          if (!cancelled) setError(json.error ?? 'Failed to load messages')
          return
        }
        const data: { conversation: Conversation; messages: Message[] } = await res.json()
        if (cancelled) return
        setConversation(data.conversation)
        setMessages(data.messages)
      } catch {
        if (!cancelled) setError('Network error — please refresh')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [orderId])

  // Realtime subscription — runs once conversation ID is known
  useEffect(() => {
    if (!conversation) return
    const supabase = createClient()
    const channel = supabase
      .channel(messagesChannel(conversation.id))
      .on<Message>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]
          )
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error('[chat] realtime subscription error:', err)
        }
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversation])

  const sendMessage = useCallback(
    async (body: string) => {
      const res = await fetch('/api/messages', {
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

  return { messages, conversation, isLoading, error, sendMessage }
}
