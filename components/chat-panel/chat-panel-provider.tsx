'use client'

/**
 * @file chat-panel-provider.tsx
 * @description Context provider that manages open chat panels and subscribes to
 *   Realtime order-status updates via the channel registry. On mount, auto-opens
 *   panels for the user's active orders; the loadActiveOrders query LEFT JOINs
 *   conversations(id) so each OrderEntry carries the conversationId — the B2
 *   pairing that lets useMessages skip its own conversations lookup. Wires
 *   useVisibilityRefetch so a backgrounded tab returning to foreground
 *   reconciles any orders accepted/cancelled while away.
 *   Called by: app/layout.tsx
 * @dependencies @/lib/realtime/channel-registry, @/hooks/use-visibility-refetch,
 *   @/lib/constants, @/lib/supabase/client
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ordersOrdererChannel } from '@/lib/constants'
import { subscribeChannel, type RegistryHandle } from '@/lib/realtime/channel-registry'
import { useVisibilityRefetch } from '@/hooks/use-visibility-refetch'
import { ChatPanelContext } from './chat-panel-context'
import type { OrderEntry } from './chat-panel-context'
import type { OrderStatus } from '@/lib/types/database'

const TERMINAL_STATUSES: OrderStatus[] = ['cancelled']
const ACTIVE_STATUSES: OrderStatus[] = ['open', 'in_progress', 'completed']

interface Props {
  userId: string | null
  children: React.ReactNode
}

/**
 * Provides chat panel state to the tree; auto-opens panels for active orders on mount,
 * subscribes to order-status updates via the registry, and reconciles on tab return.
 * @param userId - Authenticated user id, or null for unauthenticated (disables auto-open + subscription)
 * @param children - The application tree to wrap
 * @called-by app/layout.tsx
 */
export function ChatPanelProvider({ userId, children }: Props) {
  const [orders, setOrders] = useState<Record<string, OrderEntry>>({})
  const ordersRef = useRef<Record<string, OrderEntry>>({})

  // Keep ref in sync so the realtime callback always sees the latest state
  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  const openPanel = useCallback(
    (
      orderId: string,
      status: OrderStatus = 'open',
      eateryName = '',
      conversationId: string | null = null
    ) => {
      setOrders((prev) => {
        if (prev[orderId]) {
          // Backfill eateryName / conversationId if either was unknown when first opened
          const next = { ...prev[orderId] }
          let changed = false
          if (eateryName && !next.eateryName) {
            next.eateryName = eateryName
            changed = true
          }
          if (conversationId && !next.conversationId) {
            next.conversationId = conversationId
            changed = true
          }
          return changed ? { ...prev, [orderId]: next } : prev
        }
        return {
          ...prev,
          [orderId]: { orderId, status, eateryName, conversationId, isExpanded: true },
        }
      })
    },
    []
  )

  const closePanel = useCallback((orderId: string) => {
    setOrders((prev) => {
      if (!prev[orderId]) return prev
      const next = { ...prev }
      delete next[orderId]
      return next
    })
  }, [])

  const toggleMinimize = useCallback((orderId: string) => {
    setOrders((prev) => {
      const entry = prev[orderId]
      if (!entry) return prev
      return { ...prev, [orderId]: { ...entry, isExpanded: !entry.isExpanded } }
    })
  }, [])

  const updateOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    setOrders((prev) => {
      if (!prev[orderId]) return prev
      if (TERMINAL_STATUSES.includes(status)) {
        const next = { ...prev }
        delete next[orderId]
        return next
      }
      return { ...prev, [orderId]: { ...prev[orderId], status } }
    })
  }, [])

  // --- Auto-open active orders ---
  // The loadActiveOrders query LEFT JOINs conversations(id) so each panel is
  // opened with a pre-resolved conversationId (B2 pairing — no per-panel
  // client-side conversations lookup in useMessages).
  const loadActiveOrders = useCallback(async () => {
    if (!userId) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const isAnon = user?.is_anonymous ?? false

    const query = supabase
      .from('orders')
      .select('id, status, restaurant_name, conversations(id)')
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: true })

    const { data } = isAnon
      ? await query.eq('anon_user_id', userId)
      : await query.eq('orderer_id', userId)

    for (const order of data ?? []) {
      const restaurantName = (order as { restaurant_name?: string }).restaurant_name ?? ''
      const conversationsArray =
        (order as { conversations?: Array<{ id: string }> | { id: string } | null }).conversations
      const conversationId = Array.isArray(conversationsArray)
        ? conversationsArray[0]?.id ?? null
        : conversationsArray?.id ?? null
      openPanel(order.id, order.status as OrderStatus, restaurantName, conversationId)
    }
  }, [userId, openPanel])

  useEffect(() => {
    if (!userId) return
    // Defer through a microtask so the setState calls inside loadActiveOrders
    // run after the effect body returns — keeps react-hooks/set-state-in-effect
    // satisfied (the rule only flags synchronous setState in the effect body).
    void Promise.resolve().then(() => loadActiveOrders().catch(() => {
      // Silent — visibility-refetch will reattempt
    }))
  }, [userId, loadActiveOrders])

  // Visibility refetch — reconcile the auto-open list when tab returns to foreground.
  // Wraps loadActiveOrders so a swiper accepting an order while we're backgrounded
  // surfaces as soon as the user comes back.
  useVisibilityRefetch(loadActiveOrders)

  // --- Realtime: status updates via the channel registry ---
  useEffect(() => {
    if (!userId) return
    const uid: string = userId
    let handle: RegistryHandle | null = null

    async function subscribe() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const isAnon = user?.is_anonymous ?? false
      const filterField = isAnon ? 'anon_user_id' : 'orderer_id'

      try {
        handle = subscribeChannel({
          channelName: ordersOrdererChannel(uid),
          validateUuid: uid,
          configure: (channel) =>
            channel.on<{ id: string; status: OrderStatus }>(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `${filterField}=eq.${uid}`,
              },
              (payload) => {
                if (ordersRef.current[payload.new.id]) {
                  updateOrderStatus(payload.new.id, payload.new.status)
                }
              }
            ),
        })
      } catch {
        // §11 fail-closed: if registry refuses subscribe (e.g. malformed userId),
        // the visibility-refetch path keeps the panel list eventually consistent.
      }
    }

    void subscribe()

    return () => {
      handle?.unsubscribe()
    }
  }, [userId, updateOrderStatus])

  return (
    <ChatPanelContext.Provider
      value={{
        orders,
        openPanel,
        closePanel,
        toggleMinimize,
        updateOrderStatus,
      }}
    >
      {children}
    </ChatPanelContext.Provider>
  )
}
