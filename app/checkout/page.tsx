'use client'

/**
 * @file page.tsx
 * @description Checkout page: signed-URL cart preview + auth-branched form
 *   (guest gets a name field; authed-with-profile does not) → Stripe Embedded
 *   Checkout. Reads screenshot paths from sessionStorage; redirects home if
 *   empty. Errors render inline above the Pay button.
 *   Called by: Next.js routing (/checkout), app/page.tsx (router.push)
 * @dependencies @stripe/react-stripe-js, lib/supabase/client.ts,
 *   components/{back-button, ui/button, ui/input, ui/surface, ui/skeleton}
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { Skeleton } from '@/components/ui/skeleton'
import { BackButton } from '@/components/back-button'
import { createClient } from '@/lib/supabase/client'
import { PENDING_SCREENSHOTS_KEY } from '@/lib/constants'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type Stage = 'form' | 'submitting' | 'checkout'
type ViewerKind = 'loading' | 'guest' | 'authed'

export default function CheckoutPage() {
  const router = useRouter()
  const [screenshotPaths, setScreenshotPaths] = useState<string[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [viewerKind, setViewerKind] = useState<ViewerKind>('loading')

  const [name, setName] = useState('')
  const [eatery, setEatery] = useState('')
  const [total, setTotal] = useState('')
  const [stage, setStage] = useState<Stage>('form')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  // sessionStorage bootstrap — redirect home if no screenshots are queued.
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const raw = sessionStorage.getItem(PENDING_SCREENSHOTS_KEY)
    let paths: string[] = []
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.every((p): p is string => typeof p === 'string')) {
          paths = parsed
        }
      } catch {
        // Malformed sessionStorage — fall through to redirect.
      }
    }
    if (paths.length === 0) {
      router.replace('/')
      return
    }
    setScreenshotPaths(paths)
  }, [router])

  // Resolve viewerKind: a Supabase user without a profile row is a guest
  // for backend purposes (the API requires guest_name in that case).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setViewerKind('guest')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      setViewerKind(profile ? 'authed' : 'guest')
    })()
    return () => { cancelled = true }
  }, [])

  // Load signed display URLs for the cart preview.
  useEffect(() => {
    if (screenshotPaths.length === 0) return
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      const { data, error: signErr } = await supabase.storage
        .from('cart-screenshots')
        .createSignedUrls(screenshotPaths, 3600)
      if (cancelled || signErr || !data) return
      setPreviewUrls(data.map((d) => d.signedUrl).filter((u): u is string => typeof u === 'string'))
    })()
    return () => { cancelled = true }
  }, [screenshotPaths])

  const totalCents = parseCents(total)
  const eateryValid = eatery.trim().length >= 1 && eatery.trim().length <= 80
  const totalValid = totalCents !== null && totalCents >= 50
  const nameValid = viewerKind === 'authed' ? true : name.trim().length > 0
  const canSubmit =
    eateryValid && totalValid && nameValid &&
    stage === 'form' && viewerKind !== 'loading'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || totalCents === null) return
    setStage('submitting')
    setError(null)

    const body: Record<string, unknown> = {
      restaurant_name: eatery.trim(),
      cart_screenshot_paths: screenshotPaths,
      total_cents: totalCents,
    }
    if (viewerKind === 'guest') {
      body.guest_name = name.trim()
    }

    try {
      const res = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { clientSecret?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to create payment session')
      if (!json.clientSecret) throw new Error('No client secret returned')
      // Clear sessionStorage only after the session is confirmed so a Stripe
      // failure leaves the paths behind for retry.
      sessionStorage.removeItem(PENDING_SCREENSHOTS_KEY)
      setClientSecret(json.clientSecret)
      setStage('checkout')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStage('form')
    }
  }

  if (clientSecret) {
    return (
      <main
        data-testid="checkout-page"
        className="mx-auto max-w-3xl py-6 sm:py-10"
      >
        <div className="mb-4">
          <BackButton />
        </div>
        <Surface
          tone="subtle"
          padding="none"
          data-testid="checkout-stripe-embedded"
          className="overflow-hidden"
        >
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </Surface>
      </main>
    )
  }

  const isSubmitting = stage === 'submitting'

  return (
    <main
      data-testid="checkout-page"
      className="mx-auto max-w-5xl py-6 sm:py-10"
    >
      <div className="mb-6">
        <BackButton />
      </div>

      <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-12">
        <section
          data-testid="checkout-cart-preview"
          className="flex flex-col gap-3"
        >
          <h2 className="text-sm font-medium text-muted-foreground">Your cart</h2>
          {previewUrls.length === 0 ? (
            <Skeleton className="aspect-square w-full max-w-md rounded-2xl" />
          ) : (
            <div className="flex flex-col gap-3">
              {previewUrls.map((url, idx) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={`Cart screenshot ${idx + 1}`}
                  className="w-full max-w-md rounded-2xl border border-border bg-card object-contain"
                />
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col">
          <header className="mb-6">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Pay for your order.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Once you pay, a swiper at your school picks it up.
            </p>
          </header>

          {viewerKind === 'loading' ? (
            <FormSkeleton />
          ) : (
            <CheckoutForm
              kind={viewerKind}
              name={name} setName={setName}
              eatery={eatery} setEatery={setEatery}
              total={total} setTotal={setTotal}
              isSubmitting={isSubmitting}
              canSubmit={canSubmit}
              error={error}
              totalCents={totalCents}
              onSubmit={handleSubmit}
            />
          )}
        </section>
      </div>
    </main>
  )
}

// --- Helpers ---

interface CheckoutFormProps {
  kind: 'guest' | 'authed'
  name: string
  setName: (v: string) => void
  eatery: string
  setEatery: (v: string) => void
  total: string
  setTotal: (v: string) => void
  isSubmitting: boolean
  canSubmit: boolean
  error: string | null
  totalCents: number | null
  onSubmit: (e: React.FormEvent) => void
}

/**
 * Renders the guest- or authed-variant of the checkout form. The two share
 * 90%+ of their structure; the only difference is whether the name field is
 * present in the DOM and the testid carried by the form root.
 * @called-by CheckoutPage
 */
function CheckoutForm({
  kind, name, setName, eatery, setEatery, total, setTotal,
  isSubmitting, canSubmit, error, totalCents, onSubmit,
}: CheckoutFormProps) {
  const isGuest = kind === 'guest'
  const formTestId = isGuest ? 'checkout-form-guest' : 'checkout-form-authed'
  const buttonLabel = isSubmitting
    ? 'Creating session…'
    : totalCents !== null ? `Pay ${formatDollars(totalCents)}` : 'Pay'

  return (
    <form
      data-testid={formTestId}
      onSubmit={onSubmit}
      className="flex flex-col gap-4"
    >
      {isGuest && (
        <FieldRow label="Your full name" htmlFor="checkout-name">
          <Input
            id="checkout-name"
            type="text"
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            disabled={isSubmitting}
            autoComplete="name"
          />
        </FieldRow>
      )}

      <FieldRow label="Restaurant" htmlFor="checkout-eatery">
        <Input
          id="checkout-eatery"
          type="text"
          placeholder="e.g. Chipotle"
          value={eatery}
          onChange={(e) => setEatery(e.target.value)}
          maxLength={80}
          disabled={isSubmitting}
        />
      </FieldRow>

      <FieldRow label="Total (USD)" htmlFor="checkout-total" hint="Minimum $0.50">
        <Input
          id="checkout-total"
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          min="0.50"
          step="0.01"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          disabled={isSubmitting}
        />
      </FieldRow>

      {error && (
        <p
          data-testid="checkout-error-message"
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={!canSubmit || isSubmitting}
        className="mt-2 w-full"
        data-testid="checkout-submit-button"
      >
        {buttonLabel}
      </Button>
    </form>
  )
}

/**
 * Loading-state placeholder for the auth-branched form. Mirrors the
 * eventual form's vertical rhythm so the layout doesn't reflow.
 */
function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="mt-2 h-9 w-full" />
    </div>
  )
}

interface FieldRowProps {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}

/**
 * Single label + control + optional hint stack. Inlined helper because the
 * pattern repeats four times across the two form variants.
 */
function FieldRow({ label, htmlFor, hint, children }: FieldRowProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/**
 * Converts a user-entered dollar string to integer cents.
 * @param value - Dollar amount string (e.g. "12.50")
 * @returns Integer cents, or null if the input is invalid
 */
function parseCents(value: string): number | null {
  const n = parseFloat(value)
  if (isNaN(n) || n <= 0) return null
  return Math.round(n * 100)
}

/**
 * Formats integer cents as a US dollar string (e.g. 1250 → "$12.50").
 */
function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
