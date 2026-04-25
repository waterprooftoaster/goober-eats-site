'use client'

/**
 * @file error.tsx
 * @description Error boundary for /checkout/return. Catches the rare case
 *   where the Stripe SDK retrieval throws an exception that escapes the
 *   page's `try/catch`. Renders a tinted Surface with retry + home CTAs.
 *   Called by: Next.js App Router (error boundary at /checkout/return)
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
 * Renders the /checkout/return error fallback. Payment may already have
 * succeeded — direct the user to their orders surface so they can confirm.
 * @called-by Next.js error boundary at /checkout/return
 */
export default function CheckoutReturnErrorBoundary({ error, reset }: Props) {
  return (
    <main className="mx-auto max-w-2xl py-12">
      <Surface tone="muted" padding="lg" className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          We&rsquo;re finalizing your order.
        </h1>
        <p className="text-sm text-muted-foreground">
          We hit a hiccup confirming the payment with Stripe. If your card was
          charged, the order will show up under My Orders shortly.
          {error.digest ? <> Reference: <code>{error.digest}</code></> : null}
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/current-orders">Go to orders</Link>
          </Button>
        </div>
      </Surface>
    </main>
  )
}
