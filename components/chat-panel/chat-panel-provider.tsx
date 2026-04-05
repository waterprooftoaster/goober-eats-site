'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChatPanelContext } from './chat-panel-context'
import type { OrderEntry } from './chat-panel-context'
import type { OrderStatus } from '@/lib/types/database'

const TERMINAL_STATUSES: OrderStatus[] = ['cancelled']
const ACTIVE_STATUSES: OrderStatus[] = ['open', 'in_progress', 'completed']

interface Props {
  userId: string | null
  children: React.ReactNode
}

export function ChatPanelProvider({ userId, children }: Props) {
  const [orders, setOrders] = useState<Record<string, OrderEntry>>({})
  const ordersRef = useRef<Record<string, OrderEntry>>({})

  // Keep ref in sync so the Realtime callback always sees the latest state
  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  const openPanel = useCallback((orderId: string, status: OrderStatus = 'open', isGuest = false) => {
    setOrders((prev) => {
      if (prev[orderId]) return prev // idempotent — don't reset an already-open panel
      return { ...prev, [orderId]: { orderId, status, isExpanded: true, isGuest } }
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
      const { data } = await supabase
        .from('orders')
        .select('id, status')
        .eq('orderer_id', userId)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: true }) // oldest first → leftmost panel
      if (cancelled) return
      for (const order of data ?? []) {
        openPanel(order.id, order.status as OrderStatus)
      }
    }

    loadActiveOrders()
    return () => {
      cancelled = true
    }
  }, [userId, openPanel])

  // Single subscription handles all status updates for the orderer's orders:
  // swiper acceptance, in-progress, completion, cancellation, and terminal cleanup
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`orders:orderer:${userId}`)
      .on<{ id: string; status: OrderStatus }>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `orderer_id=eq.${userId}`,
        },
        (payload) => {
          // Only update panels that are currently open
          if (ordersRef.current[payload.new.id]) {
            updateOrderStatus(payload.new.id, payload.new.status)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
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
