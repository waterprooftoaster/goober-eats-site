'use client'

/**
 * @file error.tsx
 * @description Error boundary for /current-orders. Catches realtime channel
 *   failures and Supabase fetch fallthroughs that escape ChatView's inline
 *   handling. Renders a tinted Surface with retry + home CTAs.
 *   Called by: Next.js App Router (error boundary at /current-orders)
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
 * Renders the /current-orders error fallback.
 * @called-by Next.js error boundary at /current-orders
 */
export default function CurrentOrdersErrorBoundary({ error, reset }: Props) {
  return (
    <main className="mx-auto max-w-2xl py-12">
      <Surface tone="muted" padding="lg" className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Couldn&rsquo;t load your orders.
        </h1>
        <p className="text-sm text-muted-foreground">
          Tap retry — usually a flaky connection. If it keeps failing, your
          orders are still saved on our side.
          {error.digest ? <> Reference: <code>{error.digest}</code></> : null}
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button variant="primary" onClick={reset}>
            Retry
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </Surface>
    </main>
  )
}
