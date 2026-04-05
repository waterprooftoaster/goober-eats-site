'use client'

import { createContext, useContext } from 'react'
import type { OrderStatus } from '@/lib/types/database'

export interface OrderEntry {
  orderId: string
  status: OrderStatus
  isExpanded: boolean
  isGuest: boolean
}

export interface ChatPanelState {
  orders: Record<string, OrderEntry>
  openPanel: (orderId: string, status?: OrderStatus, isGuest?: boolean) => void
  closePanel: (orderId: string) => void
  toggleMinimize: (orderId: string) => void
  updateOrderStatus: (orderId: string, status: OrderStatus) => void
}

export const ChatPanelContext = createContext<ChatPanelState | null>(null)

export function useChatPanel(): ChatPanelState {
  const ctx = useContext(ChatPanelContext)
  if (!ctx) throw new Error('useChatPanel must be used inside ChatPanelProvider')
  return ctx
}
