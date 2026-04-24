'use client'

/**
 * @file chat-panel-provider.tsx
 * @description Context provider that manages open chat panels and subscribes to Realtime order updates.
 *   On mount, auto-opens panels for all of the user's active orders.
 *   Called by: app/layout.tsx
 * @dependencies lib/supabase/client.ts, components/chat-panel/chat-panel-context.ts
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ordersOrdererChannel } from '@/lib/constants'
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
 * Provides chat panel state to the tree; auto-opens panels for existing active orders on mount.
 * @param userId - The authenticated user's ID, or null for guests (disables auto-open and subscriptions)
 * @param children - The application tree to wrap
 * @called-by app/layout.tsx
 */
export function ChatPanelProvider({ userId, children }: Props) {
  const [orders, setOrders] = useState<Record<string, OrderEntry>>({})
  const ordersRef = useRef<Record<string, OrderEntry>>({})

  // Keep ref in sync so the Realtime callback always sees the latest state
  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  const openPanel = useCallback((orderId: string, status: OrderStatus = 'open', eateryName = '') => {
    setOrders((prev) => {
      if (prev[orderId]) {
        // Backfill eateryName if the panel was opened before the name was known
        if (eateryName && !prev[orderId].eateryName) {
          return { ...prev, [orderId]: { ...prev[orderId], eateryName } }
        }
        return prev
      }
      return { ...prev, [orderId]: { orderId, status, eateryName, isExpanded: true } }
    })
  }, [])

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
        // Auto-close panel when order reaches a terminal state
        const next = { ...prev }
        delete next[orderId]
        return next
      }
      return { ...prev, [orderId]: { ...prev[orderId], status } }
    })
  }, [])

  // On mount: auto-open panels for all of the user's incomplete orders
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function loadActiveOrders() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const isAnon = user?.is_anonymous ?? false

      const query = supabase
        .from('orders')
        .select('id, status, eateries(name)')
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: true })

      const { data } = isAnon
        ? await query.eq('anon_user_id', userId)
        : await query.eq('orderer_id', userId)

      if (cancelled) return
      for (const order of data ?? []) {
        const eateryName = (order.eateries as unknown as { name: string } | null)?.name ?? ''
        openPanel(order.id, order.status as OrderStatus, eateryName)
      }
    }

    loadActiveOrders()
    return () => {
      cancelled = true
    }
  }, [userId, openPanel])

  // Single subscription handles all status updates for the orderer's orders:
  // swiper acceptance, in-progress, completion, cancellation, and terminal cleanup.
  // Uses anon_user_id filter for anonymous users, orderer_id for authenticated users.
  useEffect(() => {
    if (!userId) return
    const uid: string = userId

    const supabase = createClient()

    async function subscribe() {
      const { data: { user } } = await supabase.auth.getUser()
      const isAnon = user?.is_anonymous ?? false
      const filterField = isAnon ? 'anon_user_id' : 'orderer_id'

      const channel = supabase
        .channel(ordersOrdererChannel(uid))
        .on<{ id: string; status: OrderStatus }>(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `${filterField}=eq.${uid}`,
          },
          (payload) => {
            // Only update panels that are currently open
            if (ordersRef.current[payload.new.id]) {
              updateOrderStatus(payload.new.id, payload.new.status)
            }
          }
        )
        .subscribe()

      return channel
    }

    const channelPromise = subscribe()

    return () => {
      channelPromise.then((channel) => supabase.removeChannel(channel))
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
