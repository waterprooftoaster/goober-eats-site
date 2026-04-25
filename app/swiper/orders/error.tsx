'use client'

/**
 * @file error.tsx
 * @description Colocated error boundary for /swiper/orders. Distinct from
 *   the global boundary because failure modes are queue-specific:
 *   PATCH /api/orders/[id]/accept 5xx, signed-URL expiry mid-render,
 *   profile lookup failure on the server fetch. Sanitized message; reset()
 *   re-runs the page render, "Back to account" exits the queue cleanly.
 *   Called by: Next.js App Router (auto-mounted on render error in
 *   app/swiper/orders/**).
 * @dependencies components/ui/{button,surface}
 */

import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'

interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Renders a recovery surface when /swiper/orders crashes during render or
 * data fetch. Strips paths and stack-trace fragments before display.
 * @param error - The caught error; digest exposed for support correlation
 * @param reset - Re-runs the page render
 * @called-by Next.js App Router
 */
export default function SwiperOrdersError({ error, reset }: ErrorBoundaryProps) {
  return (
    <main className="mx-auto max-w-2xl py-12 sm:py-16">
      <Surface tone="muted" padding="lg" className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Couldn&rsquo;t load the queue.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {sanitize(error.message)}
          </p>
          {error.digest && (
            <p className="mt-2 text-xs text-muted-foreground">
              Reference: <span className="font-mono">{error.digest}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Button variant="ghost" asChild>
            <a href="/account">Back to account</a>
          </Button>
        </div>
      </Surface>
    </main>
  )
}

// --- Helpers ---

/**
 * Strips file paths, line numbers, and stack-trace fragments from an error
 * message so internal details don't leak to the user.
 * @param message - The raw error message
 * @returns A sanitized one-liner safe to display
 */
function sanitize(message: string): string {
  if (!message) return 'Something went wrong loading the queue. Try again in a moment.'
  const firstLine = message.split('\n')[0] ?? ''
  return firstLine.replace(/\s*at\s.*$/g, '').replace(/\s*\(.*?:\d+:\d+\).*$/g, '').trim()
    || 'Something went wrong loading the queue. Try again in a moment.'
}
