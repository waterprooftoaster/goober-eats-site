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
import { ordersOrdererChannel, ordersSwiperChannel } from '@/lib/constants'
import { subscribeChannel, type RegistryHandle } from '@/lib/realtime/channel-registry'
import { useVisibilityRefetch } from '@/hooks/use-visibility-refetch'
import { ChatPanelContext } from './chat-panel-context'
import type { OrderEntry } from './chat-panel-context'
import type { OrderStatus } from '@/lib/types/database'

const TERMINAL_STATUSES: OrderStatus[] = ['cancelled']
// Auto-open only truly active orders. Completed orders stay visible while the
// panel is already open (real-time UPDATE → updateOrderStatus keeps the panel
// mounted so the orderer sees the completion view), but on refresh they live
// on /orders (history) and must not auto-re-open here.
const ACTIVE_STATUSES: OrderStatus[] = ['open', 'in_progress']

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

  // User-dismissed panel ids — excluded from re-opening on visibility refetch
  // and realtime status updates. Persists for the session (intentional: a
  // dismissed panel stays dismissed until the user navigates or reloads).
  const dismissedOrderIdsRef = useRef<Set<string>>(new Set())

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
      // Skip user-dismissed panels — loadActiveOrders + visibility refetch can
      // re-discover the same order; the dismissed-set is what keeps the panel
      // closed across those re-runs (S07 code-review MEDIUM #2).
      if (dismissedOrderIdsRef.current.has(orderId)) return
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
          [orderId]: { orderId, status, eateryName, conversationId },
        }
      })
    },
    []
  )

  const closePanel = useCallback((orderId: string) => {
    // Record the dismissal BEFORE removing from state so a racing
    // loadActiveOrders that fires concurrently can't beat us to a re-open.
    dismissedOrderIdsRef.current.add(orderId)
    setOrders((prev) => {
      if (!prev[orderId]) return prev
      const next = { ...prev }
      delete next[orderId]
      return next
    })
  }, [])

  const updateOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    // A status change is a meaningful lifecycle event; clear any prior dismissal
    // so the next loadActiveOrders / openPanel call can re-surface the panel.
    // Concrete scenario: orderer dismisses their panel during in_progress, the
    // swiper un-accepts (status returns to 'open'), the orderer should see the
    // panel re-open since the order is no longer being filled.
    dismissedOrderIdsRef.current.delete(orderId)
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

  // Cache the auth.getUser → is_anonymous resolution so loadActiveOrders and
  // the realtime subscribe effect share a single round trip per mount (instead
  // of issuing one getUser each).
  const isAnonPromiseRef = useRef<Promise<boolean> | null>(null)
  const resolveIsAnonymous = useCallback((supabase: ReturnType<typeof createClient>) => {
    if (!isAnonPromiseRef.current) {
      isAnonPromiseRef.current = supabase.auth.getUser().then(
        ({ data: { user } }) => user?.is_anonymous ?? false
      )
    }
    return isAnonPromiseRef.current
  }, [])

  // --- Auto-open active orders ---
  // The loadActiveOrders query LEFT JOINs conversations(id) so each panel is
  // opened with a pre-resolved conversationId (B2 pairing — no per-panel
  // client-side conversations lookup in useMessages).
  const loadActiveOrders = useCallback(async () => {
    if (!userId) return
    const supabase = createClient()
    const isAnon = await resolveIsAnonymous(supabase)

    const query = supabase
      .from('orders')
      .select('id, status, restaurant_name, conversations(id)')
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: true })

    // Authenticated users can be either the orderer or the swiper; mirror
    // the server-side query in app/current-orders/page.tsx so the bottom-dock
    // pill counts swiper-accepted orders. Anonymous users only ever own
    // orders via anon_user_id.
    const { data } = isAnon
      ? await query.eq('anon_user_id', userId)
      : await query.or(`orderer_id.eq.${userId},swiper_id.eq.${userId}`)

    for (const order of data ?? []) {
      const restaurantName = (order as { restaurant_name?: string }).restaurant_name ?? ''
      const conversationsArray =
        (order as { conversations?: Array<{ id: string }> | { id: string } | null }).conversations
      const conversationId = Array.isArray(conversationsArray)
        ? conversationsArray[0]?.id ?? null
        : conversationsArray?.id ?? null
      openPanel(order.id, order.status as OrderStatus, restaurantName, conversationId)
    }
  }, [userId, openPanel, resolveIsAnonymous])

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
    let ordererHandle: RegistryHandle | null = null
    let swiperHandle: RegistryHandle | null = null

    /**
     * Common UPDATE handler for both orderer and swiper subscriptions.
     * Both channels deliver the same payload shape; the only difference is
     * the postgres-side filter field.
     */
    function onOrderUpdate(payload: { new: { id: string; status: OrderStatus } }) {
      const id = payload.new.id
      if (ordersRef.current[id]) {
        updateOrderStatus(id, payload.new.status)
        return
      }
      // Order is not currently in state — most likely user dismissed
      // it. A status change is a meaningful lifecycle event that
      // should re-engage the user (e.g. swiper un-accept reverts
      // in_progress → open; orderer needs to see the panel again).
      // Skip terminal statuses: re-opening a dismissed panel just to
      // immediately remove it via TERMINAL_STATUSES causes a flash render.
      if (
        dismissedOrderIdsRef.current.has(id) &&
        !TERMINAL_STATUSES.includes(payload.new.status)
      ) {
        dismissedOrderIdsRef.current.delete(id)
        openPanel(id, payload.new.status)
      }
    }

    async function subscribe() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const isAnon = user?.is_anonymous ?? false
      const ordererFilterField = isAnon ? 'anon_user_id' : 'orderer_id'

      try {
        ordererHandle = subscribeChannel({
          channelName: ordersOrdererChannel(uid),
          validateUuid: uid,
          configure: (channel) =>
            channel.on<{ id: string; status: OrderStatus }>(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `${ordererFilterField}=eq.${uid}`,
              },
              onOrderUpdate
            ),
        })
      } catch {
        // §11 fail-closed: if registry refuses subscribe (e.g. malformed userId),
        // the visibility-refetch path keeps the panel list eventually consistent.
      }

      // Authenticated users may also be a swiper for some orders. Anonymous
      // users can never be swipers (Stripe Connect onboarding requires auth),
      // so skip the second subscription for them.
      if (isAnon) return
      try {
        swiperHandle = subscribeChannel({
          channelName: ordersSwiperChannel(uid),
          validateUuid: uid,
          configure: (channel) =>
            channel.on<{ id: string; status: OrderStatus }>(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `swiper_id=eq.${uid}`,
              },
              onOrderUpdate
            ),
        })
      } catch {
        // §11 fail-closed
      }
    }

    void subscribe()

    return () => {
      ordererHandle?.unsubscribe()
      swiperHandle?.unsubscribe()
    }
  }, [userId, updateOrderStatus, openPanel, resolveIsAnonymous])

  return (
    <ChatPanelContext.Provider
      value={{
        orders,
        openPanel,
        closePanel,
        updateOrderStatus,
      }}
    >
      {children}
    </ChatPanelContext.Provider>
  )
}
