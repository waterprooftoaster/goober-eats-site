'use client'

/**
 * @file complaint-form.tsx
 * @description Client component for the order complaint form. Renders a
 *   category dropdown + reason textarea, posts to /api/orders/[id]/complaints,
 *   and shows a verdict-specific result state inline (delegated to
 *   ComplaintResult so the same surface can render from page.tsx as well).
 *   Called by: app/orders/[id]/complaints/new/page.tsx
 * @dependencies components/ui/{button,textarea}, components/orders/complaint-result,
 *   lib/types/api
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { StatefulButton } from '@/components/ui/stateful-button'
import { Textarea } from '@/components/ui/textarea'
import {
  ComplaintResult,
  type ComplaintResultData,
} from '@/components/orders/complaint-result'
import type { ComplaintCategory, CreateComplaintInput } from '@/lib/types/api'

interface Props {
  orderId: string
  restaurantName: string
}

type ResolvedComplaint = ComplaintResultData

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

  const performSubmit = async () => {
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await performSubmit()
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
        <StatefulButton
          type="button"
          disabled={!canSubmit}
          showFinishState={false}
          data-testid="complaint-submit"
          onClick={performSubmit}
        >
          Submit complaint
        </StatefulButton>
      </div>
    </form>
  )
}
