'use client'

/**
 * @file chat-panel-context.ts
 * @description React context and hook for the global chat panel state (open panels, status, eatery name).
 *   Called by: components/chat-panel/chat-panel-provider.tsx, components/chat-panel/chat-panel.tsx
 */

import { createContext, useContext } from 'react'
import type { OrderStatus } from '@/lib/types/database'

export interface OrderEntry {
  orderId: string
  status: OrderStatus
  eateryName: string
  isExpanded: boolean
  /**
   * Pre-resolved conversation_id from the provider's loadActiveOrders LEFT JOIN.
   * Null when no conversation exists yet (status='open' before swiper accepts).
   * Plumbed down into ChatView → useMessages so the hook can subscribe-before-
   * fetch without an extra client query (B2 pairing — eliminates the per-mount
   * conversations lookup across N open panels).
   */
  conversationId: string | null
}

export interface ChatPanelState {
  orders: Record<string, OrderEntry>
  openPanel: (
    orderId: string,
    status?: OrderStatus,
    eateryName?: string,
    conversationId?: string | null
  ) => void
  closePanel: (orderId: string) => void
  toggleMinimize: (orderId: string) => void
  updateOrderStatus: (orderId: string, status: OrderStatus) => void
}

export const ChatPanelContext = createContext<ChatPanelState | null>(null)

/**
 * Returns the ChatPanelContext value; throws if called outside ChatPanelProvider.
 * @returns Current chat panel state with open/close/toggle/update actions
 * @called-by components/chat-panel/chat-panel.tsx, app/swiper/orders/pending-orders-list.tsx
 */
export function useChatPanel(): ChatPanelState {
  const ctx = useContext(ChatPanelContext)
  if (!ctx) throw new Error('useChatPanel must be used inside ChatPanelProvider')
  return ctx
}
