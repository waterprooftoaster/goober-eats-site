'use client'

/**
 * @file chat-input.tsx
 * @description Chat message input with text send and delivery photo upload controls.
 *   Called by: components/chat/chat-view.tsx
 * @dependencies components/ui/button.tsx
 */

import { useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { Camera, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  orderId: string
  onSend: (body: string) => Promise<void>
  disabled: boolean
}

/**
 * Renders the message input bar with a textarea, camera upload button, and send button.
 * @param orderId - UUID of the order; used to POST image uploads to the correct endpoint
 * @param onSend - Async callback invoked with the message body when the user sends
 * @param disabled - Disables all controls (e.g. when the conversation is closed)
 * @called-by components/chat/chat-view.tsx
 */
export function ChatInput({ orderId, onSend, disabled }: Props) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/messages/${orderId}/upload`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setUploadError(json.error ?? 'Upload failed')
      }
    } catch {
      setUploadError('Network error — upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const isDisabled = disabled || sending || uploading

  return (
    <div className="border-t border-gray-100 bg-white px-3 py-2">
      {sendError && <p className="mb-1 text-xs text-red-600">{sendError}</p>}
      {uploadError && <p className="mb-1 text-xs text-red-600">{uploadError}</p>}
      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          rows={1}
          placeholder={disabled ? 'Conversation closed' : 'Type a message…'}
          className={cn(
            'flex-1 resize-none rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm',
            'placeholder:text-gray-400 outline-none',
            'focus-visible:border-gray-400 focus-visible:ring-2 focus-visible:ring-gray-200',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'min-h-[36px] max-h-[120px] overflow-y-auto',
          )}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
          disabled={isDisabled}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isDisabled}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload delivery photo"
        >
          <Camera className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          disabled={isDisabled || !body.trim()}
          onClick={handleSend}
          aria-label="Send message"
        >
          {sending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      {uploading && <p className="mt-1 text-xs text-gray-400">Uploading photo…</p>}
    </div>
  )
}
