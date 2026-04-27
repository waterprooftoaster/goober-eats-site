/**
 * @file page.tsx
 * @description Static landing page for Stripe Connect's `refreshUrl` —
 *   shown when the onboarding link expires before the user finishes.
 *   Single CTA back to /swiper-registration; the registration form's
 *   Continue button creates a fresh onboarding session via POST
 *   /api/stripe/connect.
 *   Called by: Stripe Connect refreshUrl on session expiry.
 * @dependencies components/ui/{button,surface}
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'

/**
 * Renders the "Stripe link expired" surface with a single CTA back to
 * /swiper-registration. No data fetch, no auth gate — Stripe redirects
 * here with no user context.
 * @returns The expired-session surface
 * @called-by Stripe Connect onboarding refreshUrl
 */
export default function StripeOnboardRefreshPage() {
  return (
    <main
      data-testid="onboard-refresh-page"
      className="mx-auto max-w-md py-16 px-6 sm:py-24"
    >
      <Surface tone="subtle" padding="lg" className="flex flex-col gap-4">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Session expired.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your Stripe onboarding link timed out. Head back to registration
            to start a fresh session.
          </p>
        </header>
        <Button variant="primary" asChild>
          <Link href="/swiper-registration">Back to swiper registration</Link>
        </Button>
      </Surface>
    </main>
  )
}
