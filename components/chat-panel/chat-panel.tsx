'use client'

/**
 * @file chat-panel.tsx
 * @description Renders the open chat panels with two layouts: a stacked
 *   bottom-right column on desktop (sm+) and a vaul-powered Sheet for the
 *   newest panel on mobile (max-sm). Both share the same ChatPanelContent.
 *   The Sheet ships scrim + drag-to-dismiss + focus-trap + ESC + scroll-lock
 *   per .impeccable.md principle 1 (mobile-first, time-pressured users).
 *   Called by: app/layout.tsx
 * @dependencies @/components/chat/chat-view, @/components/ui/sheet,
 *   @/components/ui/surface, @/components/chat-panel/chat-panel-context
 */

import { useChatPanel } from './chat-panel-context'
import type { OrderEntry } from './chat-panel-context'
import { ChatView } from '@/components/chat/chat-view'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Surface } from '@/components/ui/surface'
import { useIsMobile } from '@/hooks/use-mobile'
import { ChevronUp, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/lib/types/database'

const COMPLETED: OrderStatus = 'completed'

interface DesktopPanelProps {
  entry: OrderEntry
  currentUserId: string | null
  onToggle: (orderId: string) => void
  onClose: () => void
  onStatusChange: (orderId: string, status: OrderStatus) => void
}

/**
 * Desktop variant — stacked bottom-right card. Brand-aligned via Surface tokens.
 * Only mounted when useIsMobile === false (avoids the duplicate-testid issue
 * the catalog testid `chat-panel-header` would otherwise create alongside the
 * mobile Sheet variant).
 */
function DesktopPanelItem({ entry, currentUserId, onToggle, onClose, onStatusChange }: DesktopPanelProps) {
  const { orderId, status, isExpanded } = entry
  const shortId = orderId.slice(0, 8)

  if (!isExpanded) {
    return (
      <button
        onClick={() => onToggle(orderId)}
        data-testid="chat-panel-header"
        className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg hover:bg-foreground/90"
      >
        <span>Order #{shortId}</span>
        <ChevronUp className="h-4 w-4" />
      </button>
    )
  }

  return (
    <Surface
      className={cn(
        'flex flex-col rounded-lg border border-border shadow-xl',
        'w-[360px] min-h-[28rem]'
      )}
    >
      <div data-testid="chat-panel-header" className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-sm font-semibold">Order #{shortId}</span>
        {status === COMPLETED ? (
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => onToggle(orderId)}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Minimize chat"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <ChatView
          orderId={orderId}
          conversationId={entry.conversationId}
          currentUserId={currentUserId}
          orderStatus={status}
          eateryName={entry.eateryName}
          onStatusChange={(s) => onStatusChange(orderId, s)}
        />
      </div>
    </Surface>
  )
}

interface MobilePanelProps {
  entry: OrderEntry
  currentUserId: string | null
  onToggle: (orderId: string) => void
  onClose: () => void
  onStatusChange: (orderId: string, status: OrderStatus) => void
}

/**
 * Mobile variant — newest panel rendered inside a vaul Sheet (drag-to-dismiss
 * + scrim + focus trap). When status='completed', dismissing the Sheet closes
 * the panel; otherwise it minimizes (preserves the panel for re-expansion).
 * The collapsed-tab affordance is rendered as a floating bottom strip when
 * the panel is minimized.
 */
function MobileNewestPanel({ entry, currentUserId, onToggle, onClose, onStatusChange }: MobilePanelProps) {
  const { orderId, status, isExpanded } = entry
  const shortId = orderId.slice(0, 8)

  function handleOpenChange(open: boolean) {
    if (open) return
    if (status === COMPLETED) {
      onClose()
    } else {
      onToggle(orderId)
    }
  }

  if (!isExpanded) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center">
        <button
          onClick={() => onToggle(orderId)}
          data-testid="chat-panel-header"
          className="flex w-full items-center justify-between gap-2 bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg"
        >
          <span>Order #{shortId}</span>
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <Sheet open={isExpanded} onOpenChange={handleOpenChange}>
      <SheetContent className="h-[85vh] gap-2 p-0">
        <SheetTitle className="sr-only">Order #{shortId} chat</SheetTitle>
        <div data-testid="chat-panel-header" className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-sm font-semibold">Order #{shortId}</span>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <ChatView
            orderId={orderId}
            conversationId={entry.conversationId}
            currentUserId={currentUserId}
            orderStatus={status}
            eateryName={entry.eateryName}
            onStatusChange={(s) => onStatusChange(orderId, s)}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface Props {
  currentUserId: string | null
}

/**
 * Renders all open chat panels: desktop stack on md+, mobile Sheet on max-sm.
 * Viewport detection via useIsMobile so only ONE variant is mounted at a time
 * (the catalog testid `chat-panel-header` would otherwise duplicate across
 * desktop + mobile DOM nodes and trip Playwright strict mode).
 * @param currentUserId - Authenticated user id for ChatView message alignment
 * @returns null when no panels are open; otherwise the appropriate variant.
 * @called-by app/layout.tsx
 */
export function ChatPanel({ currentUserId }: Props) {
  const { orders, toggleMinimize, closePanel, updateOrderStatus } = useChatPanel()
  const isMobile = useIsMobile()

  const panelList = Object.values(orders)
  if (panelList.length === 0) return null

  // Reverse so newest order is at index 0 (top of stack visually on desktop;
  // the only panel surfaced on mobile)
  const reversed = [...panelList].reverse()
  const newest = reversed[0]

  if (isMobile) {
    return (
      <div data-testid="chat-panel-stack" className="fixed inset-x-0 bottom-0 z-50">
        <MobileNewestPanel
          entry={newest}
          currentUserId={currentUserId}
          onToggle={toggleMinimize}
          onClose={() => closePanel(newest.orderId)}
          onStatusChange={updateOrderStatus}
        />
      </div>
    )
  }

  return (
    <div data-testid="chat-panel-stack" className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-4">
      {reversed.map((entry) => (
        <DesktopPanelItem
          key={entry.orderId}
          entry={entry}
          currentUserId={currentUserId}
          onToggle={toggleMinimize}
          onClose={() => closePanel(entry.orderId)}
          onStatusChange={updateOrderStatus}
        />
      ))}
    </div>
  )
}
