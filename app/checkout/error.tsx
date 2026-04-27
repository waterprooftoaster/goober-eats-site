'use client'

/**
 * @file error.tsx
 * @description Error boundary for /checkout. Catches Stripe-mount failures and
 *   POST /api/stripe/checkout-session 5xx fallthroughs that escape the inline
 *   error path. Renders a tinted Surface with a retry CTA and a home link.
 *   Called by: Next.js App Router (error boundary at the /checkout route)
 * @dependencies components/ui/{surface,button}
 */

import Link from 'next/link'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Renders the /checkout error fallback. Sanitizes the displayed message so
 * stack frames and file paths don't leak to the user.
 * @called-by Next.js error boundary at /checkout
 */
export default function CheckoutErrorBoundary({ error, reset }: Props) {
  return (
    <main className="mx-auto max-w-2xl py-12">
      <Surface tone="muted" padding="lg" className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Checkout hit a snag.
        </h1>
        <p className="text-sm text-muted-foreground">
          We couldn&rsquo;t set up the payment form. Try again — your screenshot
          is still saved.
          {error.digest ? <> Reference: <code>{error.digest}</code></> : null}
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </Surface>
    </main>
  )
}
