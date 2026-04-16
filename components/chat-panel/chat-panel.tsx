'use client'

import { useChatPanel } from './chat-panel-context'
import type { OrderEntry } from './chat-panel-context'
import { ChatView } from '@/components/chat/chat-view'
import { ChevronUp, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/lib/types/database'

interface PanelProps {
  entry: OrderEntry
  /** 0 = newest (bottom of stack); shown on mobile */
  index: number
  currentUserId: string | null
  onToggle: (orderId: string) => void
  onClose: () => void
  onStatusChange: (orderId: string, status: OrderStatus) => void
}

function ChatPanelItem({ entry, index, currentUserId, onToggle, onClose, onStatusChange }: PanelProps) {
  const { orderId, status, isExpanded } = entry
  const shortId = orderId.slice(0, 8)
  // Only the first (newest) panel is visible on mobile; all others are hidden
  const mobileClass = index === 0
    ? 'max-sm:w-full max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0 max-sm:border-t'
    : 'max-sm:hidden'

  if (!isExpanded) {
    return (
      <div className={cn(mobileClass)}>
        <button
          onClick={() => onToggle(orderId)}
          className={cn(
            'flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-gray-800',
            index === 0 && 'max-sm:w-full max-sm:justify-between max-sm:rounded-none max-sm:shadow-none'
          )}
        >
          <span>Order #{shortId}</span>
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-gray-200 bg-white shadow-xl',
        'w-[360px] h-[28rem]',
        mobileClass
      )}
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5">
        <span className="text-sm font-semibold">Order #{shortId}</span>
        {status === 'completed' ? (
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => onToggle(orderId)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Minimize chat"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <ChatView
          orderId={orderId}
          currentUserId={currentUserId}
          orderStatus={status}
          eateryName={entry.eateryName}
          onStatusChange={(s) => onStatusChange(orderId, s)}
        />
      </div>
    </div>
  )
}

interface Props {
  currentUserId: string | null
}

export function ChatPanel({ currentUserId }: Props) {
  const { orders, toggleMinimize, closePanel, updateOrderStatus } = useChatPanel()

  const panelList = Object.values(orders)
  if (panelList.length === 0) return null

  // Reverse so newest order is at index 0 (bottom of column on desktop, shown on mobile)
  const reversed = [...panelList].reverse()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-4 max-sm:inset-x-0 max-sm:bottom-0 max-sm:right-0">
      {reversed.map((entry, index) => (
        <ChatPanelItem
          key={entry.orderId}
          entry={entry}
          index={index}
          currentUserId={currentUserId}
          onToggle={toggleMinimize}
          onClose={() => closePanel(entry.orderId)}
          onStatusChange={updateOrderStatus}
        />
      ))}
    </div>
  )
}
