'use client'

/**
 * @file chat-panel.tsx
 * @description Fixed-position chat panel stack rendering one ChatPanelItem per open order.
 *   Mobile shows only the newest panel; desktop shows all stacked above the bottom-right.
 *   Called by: app/layout.tsx
 * @dependencies components/chat/chat-view.tsx, components/chat-panel/chat-panel-context.ts
 */

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

/**
 * Renders a single chat panel card (expanded) or a minimized tab (collapsed).
 * @param entry - Order entry with orderId, status, eateryName, and isExpanded state
 * @param index - Stack position (0 = newest); used to show/hide on mobile
 * @param currentUserId - Passed through to ChatView for message alignment
 * @param onToggle - Toggles the expand/collapse state of this panel
 * @param onClose - Removes this panel from the stack
 * @param onStatusChange - Propagates status updates from ChatView to the global state
 * @called-by ChatPanel
 */
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
          data-testid="chat-panel-header"
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
      <div data-testid="chat-panel-header" className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5">
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

/**
 * Renders all open chat panels as a fixed stack, newest first, in the bottom-right corner.
 * @param currentUserId - The authenticated user's ID for message alignment inside ChatView
 * @returns null if there are no open panels
 * @called-by app/layout.tsx
 */
export function ChatPanel({ currentUserId }: Props) {
  const { orders, toggleMinimize, closePanel, updateOrderStatus } = useChatPanel()

  const panelList = Object.values(orders)
  if (panelList.length === 0) return null

  // Reverse so newest order is at index 0 (bottom of column on desktop, shown on mobile)
  const reversed = [...panelList].reverse()

  return (
    <div data-testid="chat-panel-stack" className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-4 max-sm:inset-x-0 max-sm:bottom-0 max-sm:right-0">
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
