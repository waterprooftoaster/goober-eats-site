'use client'

/**
 * @file page.tsx
 * @description Checkout page: 3-field form (name, eatery, total) → Stripe Embedded
 *   Checkout. Reads screenshot paths from sessionStorage set by the home page.
 *   Redirects to / if no screenshots are present.
 *   Called by: Next.js routing (/checkout), app/page.tsx (via router.push)
 * @dependencies @stripe/react-stripe-js, lib/supabase/client.ts
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type Stage = 'form' | 'submitting' | 'checkout' | 'error'

export default function CheckoutPage() {
  const router = useRouter()
  const [screenshotPaths, setScreenshotPaths] = useState<string[]>([])
  const [name, setName] = useState('')
  const [eatery, setEatery] = useState('')
  const [total, setTotal] = useState('')
  const [stage, setStage] = useState<Stage>('form')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const raw = sessionStorage.getItem('pending_screenshots')
    let paths: string[] = []
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.every((p): p is string => typeof p === 'string')) {
          paths = parsed
        }
      } catch {
        // malformed sessionStorage — fall through to redirect
      }
    }
    if (paths.length === 0) {
      router.replace('/')
      return
    }
    setScreenshotPaths(paths)
  }, [router])

  const totalCents = parseCents(total)
  const canSubmit =
    name.trim().length > 0 &&
    eatery.trim().length >= 1 && eatery.trim().length <= 80 &&
    totalCents !== null && totalCents >= 50 &&
    stage === 'form'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || totalCents === null) return
    setStage('submitting')
    setError(null)

    try {
      const res = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_name: eatery.trim(),
          cart_screenshot_paths: screenshotPaths,
          total_cents: totalCents,
          guest_name: name.trim(),
        }),
      })
      const json = await res.json() as { clientSecret?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to create payment session')
      if (!json.clientSecret) throw new Error('No client secret returned')
      // Clear sessionStorage only after the session is confirmed to prevent
      // losing the paths if the Stripe call fails.
      sessionStorage.removeItem('pending_screenshots')
      setClientSecret(json.clientSecret)
      setStage('checkout')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStage('form')
    }
  }

  if (stage === 'checkout' && clientSecret) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden max-w-2xl mx-auto mt-8">
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    )
  }

  const isSubmitting = stage === 'submitting'

  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Full name
          </label>
          <Input
            id="name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="eatery" className="block text-sm font-medium text-gray-700 mb-1">
            Eatery name
          </label>
          <Input
            id="eatery"
            type="text"
            placeholder="e.g. Chipotle"
            value={eatery}
            onChange={(e) => setEatery(e.target.value)}
            maxLength={80}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="total" className="block text-sm font-medium text-gray-700 mb-1">
            Total (USD)
          </label>
          <Input
            id="total"
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            min="0.50"
            step="0.01"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            disabled={isSubmitting}
          />
          <p className="mt-1 text-xs text-gray-500">Minimum $0.50</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={!canSubmit || isSubmitting} className="w-full">
          {isSubmitting ? 'Creating session…' : 'Pay'}
        </Button>
      </form>
    </main>
  )
}

// --- Helpers ---

/**
 * Converts a user-entered dollar string to integer cents.
 * @param value - Dollar amount string (e.g. "12.50")
 * @returns Integer cents, or null if the input is invalid
 * @called-by CheckoutPage (canSubmit, handleSubmit)
 */
function parseCents(value: string): number | null {
  const n = parseFloat(value)
  if (isNaN(n) || n <= 0) return null
  return Math.round(n * 100)
}
