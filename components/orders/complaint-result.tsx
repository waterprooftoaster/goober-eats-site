/**
 * @file complaint-result.tsx
 * @description Verdict-aware result surface rendered after a complaint exists
 *   for an order. Shared between the post-submit success state in the
 *   complaint form and the page-level render when the user lands on the
 *   complaint route after a complaint already exists.
 *   Called by: components/orders/complaint-form.tsx,
 *     app/orders/[id]/complaints/new/page.tsx
 * @dependencies components/ui/{button,surface}, lib/types/database
 */

import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import type { ComplaintVerdict } from '@/lib/types/database'

export interface ComplaintResultData {
  id: string
  verdict: ComplaintVerdict
  refund_amount_cents: number | null
}

interface Props {
  orderId: string
  result: ComplaintResultData
}

/**
 * Renders the post-submit verdict surface for a complaint.
 * @param orderId - The order this complaint belongs to (used for the View link)
 * @param result - The persisted complaint row (verdict + refund amount)
 * @returns A Surface with verdict-aware copy and back/view actions
 * @called-by components/orders/complaint-form.tsx,
 *   app/orders/[id]/complaints/new/page.tsx
 */
export function ComplaintResult({ orderId, result }: Props) {
  return (
    <Surface
      tone="subtle"
      padding="lg"
      data-testid="complaint-result"
      data-verdict={result.verdict}
      className="flex flex-col gap-3"
    >
      <h2 className="text-2xl font-semibold tracking-tight">{titleFor(result)}</h2>
      <p className="text-sm text-muted-foreground">{bodyFor(result)}</p>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button asChild variant="primary" size="default">
          <a href={`/orders`}>Back to your orders</a>
        </Button>
        <Button asChild variant="outline" size="default">
          <a href={`/order/${orderId}`}>View this order</a>
        </Button>
      </div>
    </Surface>
  )
}

// --- Helpers ---

function titleFor(r: ComplaintResultData): string {
  switch (r.verdict) {
    case 'approve_refund':
      return 'Refund issued.'
    case 'deny':
      return 'We couldn’t verify the issue.'
    case 'pending':
    case 'escalate':
    default:
      return 'Thanks — we’re reviewing.'
  }
}

function bodyFor(r: ComplaintResultData): string {
  if (r.verdict === 'approve_refund' && r.refund_amount_cents != null) {
    const amount = `$${(r.refund_amount_cents / 100).toFixed(2)}`
    return `${amount} is on its way back to your card. Refunds usually post within 5–10 business days.`
  }
  if (r.verdict === 'deny') {
    return "We compared the cart screenshots and the swiper's completion photo and couldn’t find evidence of the issue. If you believe this is wrong, please reply to your order confirmation email."
  }
  return "A team member will review your complaint and follow up. Most complaints are resolved within 24 hours."
}
