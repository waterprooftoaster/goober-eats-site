'use client'

/**
 * @file order-completion-notice.tsx
 * @description Completion view rendered inside the chat panel when the order
 *   reaches `completed`. Orderer view shows the photo plus a "Report a problem"
 *   affordance (within the 24-hour complaint window) or a status pill if a
 *   complaint already exists. Swiper view shows the photo plus an "Order
 *   Completed" label — never the complaint affordance.
 *   Called by: components/chat/chat-view.tsx
 * @dependencies components/order/cart-screenshot, components/ui/button,
 *   lib/types/database
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { CartScreenshot, CartScreenshotSkeleton } from '@/components/order/cart-screenshot'
import { Button } from '@/components/ui/button'
import type { Message } from '@/lib/types/messaging'
import type { ComplaintVerdict } from '@/lib/types/database'

type ViewerRole = 'orderer' | 'swiper'

interface ComplaintSummary {
  id: string
  verdict: ComplaintVerdict
}

interface Props {
  orderId: string
  viewerRole: ViewerRole
  deliveryPhoto: Message | null
}

export function OrderCompletedView({ orderId, viewerRole, deliveryPhoto }: Props) {
  const imageUrl = deliveryPhoto?.image_url ?? null
  const label = viewerRole === 'swiper' ? 'Order Completed' : 'Your Order is Ready!'

  return (
    <div data-testid="order-completed-view" className="flex flex-col items-center justify-center gap-4 p-4">
      {imageUrl ? (
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block transition-opacity hover:opacity-90 motion-reduce:transition-none"
        >
          <CartScreenshot src={imageUrl} alt="Completion photo from your swiper" />
        </a>
      ) : (
        <CartScreenshotSkeleton testid="order-completed-loading" />
      )}
      <p className="text-lg font-semibold text-foreground">{label}</p>
      {viewerRole === 'orderer' && <ComplaintAffordance orderId={orderId} />}
    </div>
  )
}

// --- Helpers ---

/**
 * Orderer-only "Report a problem" affordance. Fetches the complaint state for
 * the order; renders a button when none exists and a status pill once one
 * does. The 24-hour eligibility window is enforced server-side; a stale click
 * surfaces as an error after submission.
 * @param orderId - UUID of the order
 * @called-by OrderCompletedView (only when viewerRole === 'orderer')
 */
function ComplaintAffordance({ orderId }: { orderId: string }) {
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'none' } | { kind: 'has'; complaint: ComplaintSummary }
  >({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch(`/api/orders/${orderId}/complaints`, { method: 'GET' })
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 404) {
          setState({ kind: 'none' })
          return
        }
        if (res.ok) {
          const body = (await res.json()) as { complaint: ComplaintSummary }
          setState({ kind: 'has', complaint: body.complaint })
          return
        }
        // Any other status: silently fail-closed (hide the button) so a flaky
        // call doesn't show two affordances at once.
        setState({ kind: 'has', complaint: { id: '', verdict: 'pending' } })
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'none' })
      })
    return () => {
      cancelled = true
    }
  }, [orderId])

  if (state.kind === 'loading') return null
  if (state.kind === 'has') {
    return (
      <p
        data-testid="order-completed-complaint-pill"
        data-verdict={state.complaint.verdict}
        className="text-xs text-muted-foreground"
      >
        {verdictLabel(state.complaint.verdict)}
      </p>
    )
  }
  return (
    <Button
      asChild
      variant="subtle"
      size="sm"
      data-testid="order-completed-report-button"
    >
      <Link href={`/orders/${orderId}/complaints/new`}>Report a problem</Link>
    </Button>
  )
}

function verdictLabel(verdict: ComplaintVerdict): string {
  switch (verdict) {
    case 'approve_refund':
      return 'Refund issued'
    case 'deny':
      return 'Complaint denied'
    case 'pending':
    case 'escalate':
    default:
      return 'Complaint pending review'
  }
}
