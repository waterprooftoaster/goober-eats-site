'use client'

/**
 * @file use-swiper-queue.ts
 * @description Drives the swiper /swiper/orders queue with live updates.
 *   Subscribes via the channel registry to school-scoped INSERT/UPDATE
 *   events on `public.orders`; on any qualifying event, refetches the
 *   server-signed list from /api/swiper/pending so signed cart-screenshot
 *   URLs stay server-side. Wires useVisibilityRefetch so a backgrounded
 *   tab returning to foreground reconciles missed events. Single-consumer
 *   constraint: this hook is the only consumer of swiperQueueChannel.
 *   Called by: app/swiper/orders/pending-orders-list.tsx
 * @dependencies @/lib/realtime/channel-registry, @/lib/constants, @/hooks/use-visibility-refetch
 */

import { useCallback, useEffect, useState } from 'react'
import { swiperQueueChannel } from '@/lib/constants'
import { subscribeChannel, type RegistryHandle } from '@/lib/realtime/channel-registry'
import { useVisibilityRefetch } from '@/hooks/use-visibility-refetch'
import type { PendingOrder } from '@/app/swiper/orders/pending-orders-list'

export interface UseSwiperQueueOptions {
  schoolId: string
  initialOrders: PendingOrder[]
}

export interface UseSwiperQueueResult {
  orders: PendingOrder[]
  /** Drop a row from the local list — used by the accept-409 race path. */
  removeOrder: (orderId: string) => void
  /** Force-pull the queue from the server (also wired to visibility-change and realtime events). */
  refetch: () => Promise<void>
}

/**
 * Subscribes to school-scoped order events and reconciles the local queue
 * via /api/swiper/pending. Server signs the cart-screenshot URLs.
 * @param opts - { schoolId, initialOrders } from the server-rendered page
 * @returns { orders, removeOrder, refetch }
 * @called-by app/swiper/orders/pending-orders-list.tsx
 */
export function useSwiperQueue(opts: UseSwiperQueueOptions): UseSwiperQueueResult {
  const { schoolId, initialOrders } = opts
  const [orders, setOrders] = useState<PendingOrder[]>(initialOrders)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/swiper/pending')
      if (!res.ok) return
      const data: PendingOrder[] = await res.json()
      setOrders(data)
    } catch {
      // Silent — visibility refetch / next realtime event will retry
    }
  }, [])

  const removeOrder = useCallback((orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId))
  }, [])

  // --- Realtime subscription ---
  // RLS on `orders` already restricts which rows the swiper's session can
  // SELECT (status='open' AND swiper_id IS NULL AND school_id matches their
  // profile's school_id), so payloads delivered here are authorized. The
  // school_id postgres-side filter further reduces noise.
  useEffect(() => {
    let handle: RegistryHandle | null = null
    // INSERT and UPDATE deliver the same shape and both reconcile via refetch
    // — one wrapper closure for both.
    const onChange = () => {
      void refetch()
    }
    try {
      handle = subscribeChannel({
        channelName: swiperQueueChannel(schoolId),
        validateUuid: schoolId,
        configure: (channel) =>
          channel
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'orders',
                filter: `school_id=eq.${schoolId}`,
              },
              onChange
            )
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `school_id=eq.${schoolId}`,
              },
              onChange
            ),
      })
    } catch {
      // §11 fail-closed: refuse the subscription if schoolId is malformed.
      // The visibility-refetch path keeps the list eventually consistent.
    }
    return () => {
      handle?.unsubscribe()
    }
  }, [schoolId, refetch])

  useVisibilityRefetch(refetch)

  return { orders, removeOrder, refetch }
}
