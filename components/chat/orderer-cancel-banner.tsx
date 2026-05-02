'use client'

/**
 * @file orderer-cancel-banner.tsx
 * @description Orderer-only banner with a "Cancel order" button. Shown when
 *   the order is in 'open' state (no swiper has accepted yet). Hitting the
 *   button PATCHes /api/orders/[id]/status with status:'cancelled', which
 *   releases the auth hold via paymentIntents.cancel.
 *   Called by: components/chat/chat-view.tsx
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { OrderStatus } from '@/lib/types/database'

interface Props {
  orderId: string
  onStatusChange?: (status: OrderStatus) => void
}

/**
 * Renders a Cancel button for the orderer's open order. Two-step confirm in
 * the same banner avoids the cost of a modal for a low-stakes action.
 * @param orderId - UUID of the order to cancel
 * @param onStatusChange - Optional callback fired after a successful cancel
 * @called-by components/chat/chat-view.tsx
 */
export function OrdererCancelBanner({ orderId, onStatusChange }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCancel() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      // Hard reload on success — the route is now idempotent (handles the
      // payment_intent.canceled webhook race server-side), so a 200 means
      // the row is canonically cancelled. A fresh document load re-runs the
      // SSR query so the cancelled order is gone for sure.
      if (res.ok) {
        window.location.reload()
        return
      }
      const json = await res.json().catch(() => ({}))
      setError((json as { error?: string }).error ?? 'Failed to cancel order')
    } catch {
      setError('Network error — could not cancel order')
    } finally {
      setSubmitting(false)
    }
  }

  if (!confirming) {
    return (
      <div data-testid="orderer-cancel-banner" className="px-4 py-2">
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirming(true)}
            data-testid="orderer-cancel-button"
          >
            Cancel order
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="orderer-cancel-banner" className="px-4 py-2">
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">Are you sure?</span>
        <Button
          size="sm"
          variant="ghost"
          disabled={submitting}
          onClick={() => {
            setConfirming(false)
            setError(null)
          }}
          data-testid="orderer-cancel-back-button"
        >
          Keep order
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={submitting}
          onClick={handleCancel}
          data-testid="orderer-cancel-confirm-button"
        >
          {submitting ? (
            <>
              <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Cancelling…
            </>
          ) : (
            'Cancel order'
          )}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
