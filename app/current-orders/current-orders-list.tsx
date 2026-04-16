'use client'

import { ChatView } from '@/components/chat/chat-view'
import { useChatPanel } from '@/components/chat-panel'
import type { OrderStatus } from '@/lib/types/database'

interface Props {
  orders: { id: string; status: OrderStatus; eateryName: string }[]
  currentUserId: string
}

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
