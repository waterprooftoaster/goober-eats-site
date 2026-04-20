'use client'

/**
 * @file current-orders-list.tsx
 * @description Client component rendering a list of the orderer's active orders, each with an embedded chat view.
 *   Called by: app/current-orders/page.tsx
 * @dependencies components/chat/chat-view.tsx, components/chat-panel.tsx
 */

import { ChatView } from '@/components/chat/chat-view'
import { useChatPanel } from '@/components/chat-panel'
import type { OrderStatus } from '@/lib/types/database'

interface Props {
  orders: { id: string; status: OrderStatus; eateryName: string }[]
  currentUserId: string
}

/**
 * Renders each active order as a card with an embedded ChatView panel.
 * @param orders - List of orders with id, status, and eatery name
 * @param currentUserId - The authenticated user's ID passed to ChatView
 * @returns Order cards with chat, or an empty-state message
 * @called-by app/current-orders/page.tsx
 */
export function CurrentOrdersList({ orders, currentUserId }: Props) {
  const { updateOrderStatus } = useChatPanel()

  if (orders.length === 0) {
    return <p className="text-sm text-gray-500">No active orders.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {orders.map((order) => (
        <div
          key={order.id}
          className="flex h-[28rem] flex-col rounded-lg border border-gray-200 bg-white shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5">
            <span className="text-sm font-semibold">Order #{order.id.slice(0, 8)}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {order.status}
            </span>
          </div>
          <div className="flex flex-1 flex-col overflow-hidden">
            <ChatView
              orderId={order.id}
              currentUserId={currentUserId}
              orderStatus={order.status}
              eateryName={order.eateryName}
              onStatusChange={(status) => updateOrderStatus(order.id, status)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
