'use client'

/**
 * @file error.tsx
 * @description Colocated error boundary for /stripe/onboard/complete. Per
 *   02-routes.md §4: failure modes here are distinct from the global
 *   boundary (Stripe SDK accounts.retrieve failure that escapes the inner
 *   try/catch; service-client write failure on profile or stripe_accounts;
 *   profile lookup failure). Sanitizes message; reset() retries; "Back to
 *   registration" exits cleanly.
 *   Called by: Next.js App Router (auto-mounted on render error in
 *   app/stripe/onboard/complete/**).
 * @dependencies components/ui/{button,surface}
 */

import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'

interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Renders a recovery surface when the onboard-complete page crashes.
 * @param error - The caught error; digest exposed for support correlation
 * @param reset - Re-runs the page render
 * @called-by Next.js App Router
 */
export default function StripeOnboardCompleteError({ error, reset }: ErrorBoundaryProps) {
  return (
    <main className="mx-auto max-w-md py-16 px-6 sm:py-24">
      <Surface tone="muted" padding="lg" className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            We couldn&rsquo;t finish your setup.
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
            <a href="/swiper-registration">Back to registration</a>
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
 */
function sanitize(message: string): string {
  if (!message) return 'Something went wrong finalizing your account. Try again in a moment.'
  const firstLine = message.split('\n')[0] ?? ''
  return firstLine.replace(/\s*at\s.*$/g, '').replace(/\s*\(.*?:\d+:\d+\).*$/g, '').trim()
    || 'Something went wrong finalizing your account. Try again in a moment.'
}
