'use client'

/**
 * @file use-messages.ts
 * @description Loads + subscribes to a conversation's messages. After the S07
 *   migration, this hook implements the literal §11 subscribe-before-fetch
 *   pattern: subscribe via the channel registry FIRST, buffer realtime
 *   INSERTs, run the initial fetch, then flush the buffer through dedupe-by-
 *   `id` or `temp_id`. Also exposes optimistic-append + mark-failed callbacks
 *   for chat-input to drive instant feedback. Wires useVisibilityRefetch so a
 *   backgrounded tab returning to foreground reconciles missed messages.
 *   Called by: components/chat/chat-view.tsx
 * @dependencies @/lib/realtime/channel-registry, @/lib/constants, @/hooks/use-visibility-refetch
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { messagesChannel } from '@/lib/constants'
import { subscribeChannel, type RegistryHandle } from '@/lib/realtime/channel-registry'
import { useVisibilityRefetch } from '@/hooks/use-visibility-refetch'
import type { Conversation, Message } from '@/lib/types/messaging'

export type LocalMessageStatus = 'pending' | 'failed'

export interface OptimisticMessage extends Message {
  /** Set on locally-appended optimistic entries; cleared once the canonical row arrives via POST or realtime. */
  status?: LocalMessageStatus
}

export interface UseMessagesOptions {
  orderId: string | null
  /**
   * Pre-resolved conversation_id supplied by a parent that already queried it
   * (chat-panel-provider's loadActiveOrders LEFT JOIN). When provided,
   * useMessages skips its own conversation lookup — eliminates the per-mount
   * round-trip and collapses the potential N+1 across multiple open panels.
   */
  conversationId?: string | null
}

export interface UseMessagesResult {
  messages: OptimisticMessage[]
  conversation: Conversation | null
  isLoading: boolean
  error: string | null
  sendMessage: (body: string, temp_id?: string) => Promise<void>
  /** Optimistically append a message in `pending` state; reconciled by realtime/POST via temp_id. */
  appendOptimistic: (temp_id: string, body: string, sender_id: string | null) => void
  /** Flag a previously-appended optimistic message as failed (renders retry affordance). */
  markFailed: (temp_id: string) => void
  /** Flip a previously-failed entry back to `pending` (used by the retry flow). */
  markPending: (temp_id: string) => void
}

/**
 * Subscribes to the conversation's realtime messages and exposes optimistic-append helpers.
 * @param opts - { orderId, conversationId? } — conversationId pre-resolution avoids the extra client query.
 * @returns messages array (with optional pending/failed flags), conversation, sendMessage, appendOptimistic, markFailed.
 * @called-by components/chat/chat-view.tsx
 */
export function useMessages(opts: UseMessagesOptions): UseMessagesResult {
  const { orderId, conversationId: providedConvId } = opts

  const [messages, setMessages] = useState<OptimisticMessage[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [resolvedConvId, setResolvedConvId] = useState<string | null>(providedConvId ?? null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Subscribe-before-fetch buffer + completion flag
  const bufferRef = useRef<Message[]>([])
  const initialFetchDoneRef = useRef<boolean>(false)

  // --- Effect 1: resolve conversation_id (skip if pre-supplied) ---
  useEffect(() => {
    if (!orderId) {
      // Reset on orderId transition to null. Each setter is a no-op when the
      // value already matches, so cascade is bounded; the rule's general advice
      // doesn't apply to deliberate input-driven resets.
      /* eslint-disable react-hooks/set-state-in-effect */
      setMessages([])
      setConversation(null)
      setResolvedConvId(null)
      setIsLoading(false)
      setError(null)
      /* eslint-enable react-hooks/set-state-in-effect */
      initialFetchDoneRef.current = false
      bufferRef.current = []
      return
    }
    if (providedConvId) {
      setResolvedConvId(providedConvId)
      return
    }
    let cancelled = false
    async function resolve() {
      const supabase = createClient()
      const { data } = await supabase
        .from('conversations')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle()
      if (cancelled) return
      if (!data) {
        // No conversation yet — expected when status='open' before swiper accepts.
        setIsLoading(false)
        return
      }
      setResolvedConvId((data as { id: string }).id)
    }
    resolve()
    return () => {
      cancelled = true
    }
  }, [orderId, providedConvId])

  // --- Effect 2: subscribe via the registry BEFORE the initial fetch (master plan §11) ---
  useEffect(() => {
    if (!resolvedConvId) return
    initialFetchDoneRef.current = false
    bufferRef.current = []

    let handle: RegistryHandle | null = null
    try {
      handle = subscribeChannel({
        channelName: messagesChannel(resolvedConvId),
        validateUuid: resolvedConvId,
        configure: (channel) =>
          channel.on<Message>(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${resolvedConvId}`,
            },
            (payload) => {
              if (!initialFetchDoneRef.current) {
                bufferRef.current.push(payload.new)
                return
              }
              setMessages((prev) => mergeMessages(prev, [payload.new]))
            }
          ),
      })
    } catch (e) {
      // UUID validation should never fail here (we just resolved it from the DB),
      // but the §11 fail-closed contract requires we not silently subscribe.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(e instanceof Error ? e.message : 'Failed to subscribe')
    }

    return () => {
      handle?.unsubscribe()
    }
  }, [resolvedConvId])

  // --- Effect 3: initial fetch + buffer flush ---
  useEffect(() => {
    if (!orderId || !resolvedConvId) return
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/messages/${orderId}`)
        if (res.status === 404) {
          // No conversation yet — expected for pending orders
          if (!cancelled) setIsLoading(false)
          return
        }
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          if (!cancelled) {
            setError(json.error ?? 'Failed to load messages')
            setIsLoading(false)
          }
          return
        }
        const data: { conversation: Conversation; messages: Message[] } = await res.json()
        if (cancelled) return
        setConversation(data.conversation)
        // Flush the buffer (events that arrived between subscribe and now)
        const buffered = bufferRef.current
        bufferRef.current = []
        setMessages(mergeMessages(data.messages, buffered))
        initialFetchDoneRef.current = true
        setIsLoading(false)
      } catch {
        if (!cancelled) {
          setError('Network error — please refresh')
          setIsLoading(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [orderId, resolvedConvId])

  // --- Visibility refetch (master plan §11) ---
  const refetch = useCallback(async () => {
    if (!orderId) return
    try {
      const res = await fetch(`/api/messages/${orderId}`)
      if (!res.ok) return
      const data: { conversation: Conversation; messages: Message[] } = await res.json()
      setConversation(data.conversation)
      setMessages((prev) => mergeMessages(prev, data.messages))
    } catch {
      // Silent — the next realtime INSERT (or visibility event) will re-attempt
    }
  }, [orderId])

  useVisibilityRefetch(refetch)

  // --- sendMessage / optimistic helpers ---
  const sendMessage = useCallback(
    async (body: string, temp_id?: string) => {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, body, message_type: 'text', temp_id }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Failed to send message')
      }
      // Belt-and-suspenders: merge the POST response so the canonical message
      // is present even if the realtime echo is delayed.
      const canonical: Message = await res.json()
      setMessages((prev) => mergeMessages(prev, [canonical]))
    },
    [orderId]
  )

  const appendOptimistic = useCallback(
    (temp_id: string, body: string, sender_id: string | null) => {
      const optimistic: OptimisticMessage = {
        id: `__optimistic_${temp_id}`,
        temp_id,
        conversation_id: resolvedConvId ?? '',
        sender_id,
        body,
        message_type: 'text',
        sent_at: new Date().toISOString(),
        // 7-day expiry mirrors the server default for completion photos; text
        // messages are typically purged at 48h. Display-only — server overwrites.
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        image_url: null,
        status: 'pending',
      }
      setMessages((prev) => [...prev, optimistic])
    },
    [resolvedConvId]
  )

  const markFailed = useCallback((temp_id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.temp_id === temp_id ? { ...m, status: 'failed' as const } : m))
    )
  }, [])

  const markPending = useCallback((temp_id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.temp_id === temp_id ? { ...m, status: 'pending' as const } : m))
    )
  }, [])

  return { messages, conversation, isLoading, error, sendMessage, appendOptimistic, markFailed, markPending }
}

// --- Helpers ---

/**
 * Merges incoming server messages into existing local state, deduping by
 * `id ?? temp_id`. When an incoming message has a `temp_id` matching a local
 * optimistic entry, REPLACES the optimistic entry with the canonical row
 * (preserving the canonical id, clearing the local `status` flag).
 * @param existing - Current message state (may contain optimistic entries).
 * @param incoming - Server-confirmed messages from fetch or realtime INSERT.
 * @returns New deduped array; immutable update.
 */
function mergeMessages(existing: OptimisticMessage[], incoming: Message[]): OptimisticMessage[] {
  if (incoming.length === 0) return existing
  const result = [...existing]
  for (const msg of incoming) {
    let replaced = false
    if (msg.temp_id) {
      const idx = result.findIndex((m) => m.temp_id === msg.temp_id)
      if (idx >= 0) {
        // Replace optimistic with canonical; drop the local status flag
        const next: OptimisticMessage = { ...msg }
        result[idx] = next
        replaced = true
      }
    }
    if (replaced) continue
    if (result.some((m) => m.id === msg.id)) continue
    result.push(msg)
  }
  return result
}
