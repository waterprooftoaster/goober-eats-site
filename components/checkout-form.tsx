'use client'

import { useState, useEffect, useCallback } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type Stage = 'guest-info' | 'loading' | 'checkout' | 'error'

interface Props {
  isGuest: boolean
}

export function CheckoutForm({ isGuest }: Props) {
  const [stage, setStage] = useState<Stage>(isGuest ? 'guest-info' : 'loading')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Guest form state
  const [guestName, setGuestName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Authenticated users: fetch the session on mount.
  // fetchCheckoutSession has no setState so the effect body stays setState-free.
  useEffect(() => {
    if (isGuest) return
    fetchCheckoutSession({})
      .then((secret) => {
        setClientSecret(secret)
        setStage('checkout')
      })
      .catch(() => {
        setErrorMessage('Network error. Please try again.')
        setStage('error')
      })
  }, [isGuest])

  // Called from event handlers (retry, guest submit) — synchronous setState is fine here.
  const createSession = useCallback(async (body: Record<string, unknown>) => {
    setStage('loading')
    setErrorMessage(null)
    try {
      const secret = await fetchCheckoutSession(body)
      setClientSecret(secret)
      setStage('checkout')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStage('error')
    }
  }, [])

  function handleGuestSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!guestName.trim()) return
    setSubmitting(true)
    createSession({ guest_name: guestName.trim() }).finally(() =>
      setSubmitting(false)
    )
  }

  if (stage === 'guest-info') {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Your info
        </h2>
        <form onSubmit={handleGuestSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="guest-name" className="mb-1 block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="guest-name"
              type="text"
              required
              autoComplete="name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !guestName.trim()}
            className="w-full rounded-none bg-black py-3 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-40"
          >
            {submitting ? 'Loading...' : 'Continue to payment'}
          </button>
        </form>
      </div>
    )
  }

  if (stage === 'loading') {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-gray-200 bg-white">
        <p className="text-sm text-gray-500">Loading payment form…</p>
      </div>
    )
  }

  if (stage === 'error') {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-6">
        <p className="text-sm text-red-600">{errorMessage}</p>
        <button
          type="button"
          onClick={() => {
            if (isGuest) {
              setStage('guest-info')
            } else {
              createSession({})
            }
          }}
          className="mt-4 text-sm font-medium text-gray-900 underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    )
  }

  // stage === 'checkout'
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ clientSecret: clientSecret! }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}

// --- Helpers ---

async function fetchCheckoutSession(body: Record<string, unknown>): Promise<string> {
  const res = await fetch('/api/stripe/checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Something went wrong. Please try again.')
  return json.clientSecret as string
}
