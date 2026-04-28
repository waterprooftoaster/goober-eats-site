'use client'

/**
 * @file chat-input.tsx
 * @description Chat message input with text send control.
 *   Called by: components/chat/chat-view.tsx
 * @dependencies components/ui/button.tsx
 */

import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  onSend: (body: string) => Promise<void>
  disabled: boolean
  disabledPlaceholder?: string
}

/**
 * Renders the message input bar with a textarea and send button.
 * @param onSend - Async callback invoked with the message body when the user sends
 * @param disabled - Disables all controls (e.g. when the conversation is closed)
 * @param disabledPlaceholder - Placeholder shown while disabled; defaults to "Conversation closed"
 * @called-by components/chat/chat-view.tsx
 */
export function ChatInput({ onSend, disabled, disabledPlaceholder = 'Conversation closed' }: Props) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed || sending || disabled) return
    setSending(true)
    setSendError(null)
    try {
      await onSend(trimmed)
      setBody('')
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isDisabled = disabled || sending

  return (
    <div className="border-t border-border bg-background px-3 py-2">
      {sendError && <p role="alert" className="mb-1 text-xs text-destructive">{sendError}</p>}
      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          rows={1}
          placeholder={disabled ? disabledPlaceholder : 'Type a message…'}
          data-testid={disabled ? 'chat-input-waiting' : 'chat-input-active'}
          className={cn(
            'flex-1 resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm',
            'placeholder:text-muted-foreground outline-none',
            'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'min-h-[36px] max-h-[120px] overflow-y-auto',
          )}
        />
        <Button
          type="button"
          size="icon"
          disabled={isDisabled || !body.trim()}
          onClick={handleSend}
          aria-label="Send message"
          data-testid="chat-send-button"
          className="size-11"
        >
          {sending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent motion-reduce:animate-none" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
