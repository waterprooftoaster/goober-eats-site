'use client'

/**
 * @file complaint-form.tsx
 * @description Client component for the order complaint form. Renders a
 *   category dropdown + reason textarea, posts to /api/orders/[id]/complaints,
 *   and shows a verdict-specific result state inline. Auto-refund verdicts
 *   surface as "Refund issued — $X.XX" without a follow-up step.
 *   Called by: app/orders/[id]/complaints/new/page.tsx
 * @dependencies components/ui/{button,textarea,surface}, lib/types/api,
 *   lib/types/database
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Surface } from '@/components/ui/surface'
import type { ComplaintCategory, CreateComplaintInput } from '@/lib/types/api'
import type { ComplaintVerdict } from '@/lib/types/database'

interface Props {
  orderId: string
  restaurantName: string
  totalCents: number
}

interface ResolvedComplaint {
  id: string
  verdict: ComplaintVerdict
  refund_amount_cents: number | null
}

const CATEGORY_OPTIONS: ReadonlyArray<{ value: ComplaintCategory; label: string }> = [
  { value: 'wrong_items', label: 'Wrong items delivered' },
  { value: 'missing_items', label: 'Missing items' },
  { value: 'never_delivered', label: 'Never delivered' },
  { value: 'damaged', label: 'Damaged or spilled' },
  { value: 'other', label: 'Something else' },
]

const REASON_MIN = 20
const REASON_MAX = 1000

export function ComplaintForm({ orderId, restaurantName }: Props) {
  const router = useRouter()
  const [category, setCategory] = useState<ComplaintCategory | ''>('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResolvedComplaint | null>(null)

  const trimmedLength = reason.trim().length
  const reasonValid = trimmedLength >= REASON_MIN && trimmedLength <= REASON_MAX
  const canSubmit = category !== '' && reasonValid && !submitting

  if (result) {
    return <ComplaintResult orderId={orderId} result={result} />
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit || !category) return
    setSubmitting(true)
    setError(null)
    const body: CreateComplaintInput = { category, reason_text: reason.trim() }
    try {
      const res = await fetch(`/api/orders/${orderId}/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'Could not file complaint. Please try again.')
        setSubmitting(false)
        return
      }
      const payload = (await res.json()) as { complaint: ResolvedComplaint }
      setResult(payload.complaint)
      // The /orders list reads server-side; refresh so the row shows the pill.
      router.refresh()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setSubmitting(false)
    }
  }

  return (
    <form
      data-testid="complaint-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
    >
      <fieldset className="flex flex-col gap-2">
        <label htmlFor="complaint-category" className="text-sm font-medium">
          What happened with your order at {restaurantName}?
        </label>
        <select
          id="complaint-category"
          data-testid="complaint-category"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value as ComplaintCategory | '')}
          className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
        >
          <option value="" disabled>
            Choose a category…
          </option>
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <label htmlFor="complaint-reason" className="text-sm font-medium">
          Tell us what happened
        </label>
        <Textarea
          id="complaint-reason"
          data-testid="complaint-reason"
          rows={6}
          required
          minLength={REASON_MIN}
          maxLength={REASON_MAX}
          placeholder="Specifics help us decide quickly — what was missing, wrong, or off."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={reason.length > 0 && !reasonValid ? true : undefined}
          aria-describedby="complaint-reason-help"
        />
        <p
          id="complaint-reason-help"
          data-testid="complaint-reason-counter"
          className="text-xs text-muted-foreground"
        >
          {trimmedLength < REASON_MIN
            ? `${REASON_MIN - trimmedLength} more character${REASON_MIN - trimmedLength === 1 ? '' : 's'} needed.`
            : `${trimmedLength}/${REASON_MAX}`}
        </p>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-destructive" data-testid="complaint-error">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          size="default"
          disabled={submitting}
          onClick={() => router.push('/orders')}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="default"
          disabled={!canSubmit}
          data-testid="complaint-submit"
        >
          {submitting ? 'Reviewing…' : 'Submit complaint'}
        </Button>
      </div>
    </form>
  )
}

// --- Helpers ---

function ComplaintResult({
  orderId,
  result,
}: {
  orderId: string
  result: ResolvedComplaint
}) {
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

function titleFor(r: ResolvedComplaint): string {
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

function bodyFor(r: ResolvedComplaint): string {
  if (r.verdict === 'approve_refund' && r.refund_amount_cents != null) {
    const amount = `$${(r.refund_amount_cents / 100).toFixed(2)}`
    return `${amount} is on its way back to your card. Refunds usually post within 5–10 business days.`
  }
  if (r.verdict === 'deny') {
    return "We compared the cart screenshots and the swiper's completion photo and couldn’t find evidence of the issue. If you believe this is wrong, please reply to your order confirmation email."
  }
  return "A team member will review your complaint and follow up. Most complaints are resolved within 24 hours."
}
