'use client'

/**
 * @file completion-banner.tsx
 * @description Swiper-only banner with "Complete Order" (photo upload) and "Unaccept" controls.
 *   Shown only to the swiper while an order is in_progress; disappears on completion.
 *   Called by: components/chat/chat-view.tsx
 */

import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { normalizeImage } from '@/lib/image/normalize'
import type { OrderStatus } from '@/lib/types/database'

interface Props {
  orderId: string
  onStatusChange?: (status: OrderStatus) => void
}

/**
 * Renders "Complete Order" and "Unaccept" action buttons for the swiper's in-progress order.
 * @param orderId - UUID of the order being fulfilled
 * @param onStatusChange - Optional callback fired after a successful status transition
 * @called-by components/chat/chat-view.tsx
 */
export function CompletionBanner({ orderId, onStatusChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [unaccepting, setUnaccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (done) return null

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0]
    if (!original) return
    setUploading(true)
    setError(null)
    try {
      const result = await normalizeImage(original)
      if (!result.ok) {
        setError('Could not read that image. Try saving it as JPEG.')
        return
      }
      const fd = new FormData()
      fd.append('file', result.file)
      const uploadRes = await fetch(`/api/messages/${orderId}/upload`, {
        method: 'POST',
        body: fd,
      })
      if (!uploadRes.ok) {
        const json = await uploadRes.json().catch(() => ({}))
        setError((json as { error?: string }).error ?? 'Upload failed')
        return
      }
    } catch {
      setError('Network error — upload failed')
      return
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }

    setCompleting(true)
    try {
      const patchRes = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      if (patchRes.ok) {
        onStatusChange?.('completed')
        setDone(true)
      } else {
        const json = await patchRes.json().catch(() => ({}))
        setError((json as { error?: string }).error ?? 'Failed to complete order')
      }
    } catch {
      setError('Network error — could not complete order')
    } finally {
      setCompleting(false)
    }
  }

  async function handleUnaccept() {
    setUnaccepting(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'open' }),
      })
      if (res.ok) {
        onStatusChange?.('open')
        setDone(true)
        window.location.reload()
        return
      } else {
        const json = await res.json().catch(() => ({}))
        setError((json as { error?: string }).error ?? 'Failed to unaccept order')
      }
    } catch {
      setError('Network error — could not unaccept order')
    } finally {
      setUnaccepting(false)
    }
  }

  const isBusy = uploading || completing || unaccepting

  return (
    <div data-testid="completion-banner" className="px-4 py-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
        disabled={isBusy}
      />
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => fileInputRef.current?.click()}
          data-testid="swiper-complete-order-button"
        >
          {uploading || completing ? (
            <>
              <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {uploading ? 'Uploading…' : 'Completing…'}
            </>
          ) : (
            'Complete Order'
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={isBusy}
          onClick={handleUnaccept}
          data-testid="swiper-unaccept-button"
        >
          {unaccepting ? (
            <>
              <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Unaccepting…
            </>
          ) : (
            'Unaccept'
          )}
        </Button>
      </div>
      {error && <p role="alert" className="mt-1 text-right text-xs text-destructive">{error}</p>}
    </div>
  )
}
