'use client'

/**
 * @file chat-thread.tsx
 * @description Scrollable thread rendering pinned pseudo-messages, real chat
 *   messages, and optimistic entries with pending/failed treatments. After
 *   the S07 C2 wiring, messages are OptimisticMessage[] (Message + optional
 *   `status: 'pending' | 'failed'`). Failed entries surface a Retry affordance
 *   that calls onRetry(temp_id, body).
 *   Called by: components/chat/chat-view.tsx
 * @dependencies lib/types/messaging.ts, hooks/use-messages.ts (OptimisticMessage)
 */

import type { RefObject } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import type { OptimisticMessage } from '@/hooks/use-messages'
import type { PseudoMessage } from '@/components/chat/chat-view'
import { cn } from '@/lib/utils'

interface Props {
  pseudoMessages: PseudoMessage[]
  messages: OptimisticMessage[]
  currentUserId: string | null
  messagesEndRef: RefObject<HTMLDivElement | null>
  /** Called when the user clicks Retry on a failed optimistic entry. */
  onRetry?: (temp_id: string, body: string) => void
}

/**
 * Renders pinned status pseudo-messages followed by real + optimistic messages.
 * Pending entries are muted with a small spinner; failed entries are muted with
 * a Retry button that re-submits via onRetry.
 * @param pseudoMessages - Status text rows pinned above real messages (not stored in DB)
 * @param messages - Real + optimistic chat messages
 * @param currentUserId - Authenticated user ID for aligning own messages to the right
 * @param messagesEndRef - Scroll anchor at the bottom of the thread
 * @param onRetry - Retry callback for failed optimistic entries
 * @called-by components/chat/chat-view.tsx
 */
export function ChatThread({ pseudoMessages, messages, currentUserId, messagesEndRef, onRetry }: Props) {
  return (
    <div data-testid="chat-thread" className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
      {pseudoMessages.map((pseudo, i) => (
        <div
          key={`pseudo-${i}`}
          className="mb-1 mr-auto flex max-w-[75%] flex-col items-start"
          data-testid={pseudo.testid}
        >
          <div className="rounded-2xl rounded-bl-sm bg-secondary px-3 py-2 text-sm text-foreground">
            {pseudo.text}
            {pseudo.action && (
              <button
                type="button"
                onClick={pseudo.action.onClick}
                data-testid="chat-pseudo-action-button"
                className="mt-2 flex w-fit items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <ImageIcon className="h-4 w-4" aria-hidden />
                {pseudo.action.label}
              </button>
            )}
          </div>
        </div>
      ))}
      {messages.map((message) => {
        const isOwn = message.sender_id === currentUserId
        const isPending = message.status === 'pending'
        const isFailed = message.status === 'failed'

        return (
          <div
            key={message.id}
            data-testid={isPending ? 'chat-message-pending' : isFailed ? 'chat-message-failed' : undefined}
            className={cn(
              'mb-1 flex max-w-[75%] flex-col',
              isOwn ? 'ml-auto items-end' : 'mr-auto items-start'
            )}
          >
            <div
              className={cn(
                'rounded-2xl px-3 py-2 text-sm',
                isOwn
                  ? 'rounded-br-sm bg-foreground text-background'
                  : 'rounded-bl-sm bg-secondary text-foreground',
                (isPending || isFailed) && 'opacity-60'
              )}
            >
              {message.body}
            </div>
            {isPending && (
              <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span aria-hidden className="h-2 w-2 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
                Sending…
              </span>
            )}
            {isFailed && (
              <div className="mt-0.5 flex items-center gap-2 text-xs text-destructive">
                <span role="alert">Failed to send.</span>
                {onRetry && message.temp_id && message.body && (
                  <button
                    type="button"
                    onClick={() => onRetry(message.temp_id!, message.body!)}
                    data-testid="chat-message-retry"
                    className="font-medium underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  )
}
