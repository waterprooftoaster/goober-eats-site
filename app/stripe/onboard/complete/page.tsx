/**
 * @file page.tsx
 * @description Stripe Connect onboarding return page (success branch). Syncs
 *   Stripe account state directly via the SDK to absorb webhook race, then
 *   uses the service client to flip is_swiper=true with an atomic
 *   compare-and-set, then redirects to /?notice=swiper_activated. Falls
 *   through to the "almost there" branch when onboarding is incomplete or
 *   school_id is missing.
 *   Called by: Stripe Connect returnUrl after onboarding completion.
 * @dependencies lib/supabase/{server,service}, lib/stripe/client,
 *   components/ui/{button,surface}
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripe } from '@/lib/stripe/client'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { HardRedirect } from './hard-redirect'

/**
 * Resolves Stripe Connect onboarding status and either activates the swiper
 * (redirect home with notice) or renders the "almost there" fallback.
 * @returns Either a redirect or the almost-there fallback element
 * @called-by Stripe Connect onboarding returnUrl
 */
export default async function StripeOnboardCompletePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stripeRow } = await supabase
    .from('stripe_accounts')
    .select('stripe_account_id, onboarding_complete')
    .eq('user_id', user.id)
    .maybeSingle()

  const serviceClient = createServiceClient()
  let onboardingComplete = stripeRow?.onboarding_complete ?? false

  // Sync Stripe directly to absorb the account.updated webhook race: the
  // user is often redirected back here before the webhook lands, so check
  // Stripe and write the DB ourselves when the SDK confirms onboarding.
  if (stripeRow && !onboardingComplete) {
    try {
      const account = await getStripe().accounts.retrieve(stripeRow.stripe_account_id)
      if (account.details_submitted && account.charges_enabled) {
        await serviceClient
          .from('stripe_accounts')
          .update({ onboarding_complete: true })
          .eq('stripe_account_id', stripeRow.stripe_account_id)
        onboardingComplete = true
      }
    } catch {
      // non-fatal: the account.updated webhook will reconcile the DB
      // independently if this SDK call fails.
    }
  }

  // Auto-activate swiper if school is set and onboarding is complete.
  // Atomic compare-and-set on is_swiper=false avoids double-activation if
  // this page is loaded twice in quick succession.
  if (onboardingComplete) {
    const { data: profile, error: profileFetchError } = await supabase
      .from('profiles')
      .select('school_id, is_swiper')
      .eq('id', user.id)
      .single()

    if (profileFetchError) {
      // Surface in server logs so production incidents are visible. The
      // school-missing guard below correctly falls through to the
      // 'almost there' UI for the user; we still want operators to see
      // the underlying DB error in Vercel logs.
      console.error('[stripe/onboard/complete] profile fetch failed', profileFetchError)
    }

    if (profile?.school_id && !profile.is_swiper) {
      await serviceClient
        .from('profiles')
        .update({ is_swiper: true })
        .eq('id', user.id)
        .eq('is_swiper', false)
    }

    if (profile?.school_id) {
      return <HardRedirect to="/swiper/welcome" />
    }
  }

  // Fallback: onboarding incomplete OR school not set.
  return (
    <main
      data-testid="onboard-almost-there-page"
      className="mx-auto max-w-md py-16 px-6 sm:py-24"
    >
      <Surface tone="subtle" padding="lg" className="flex flex-col gap-4">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Almost there.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your payment setup is still being processed. Finish picking your
            school to wrap up registration.
          </p>
        </header>
        <Button variant="primary" asChild>
          <Link href="/swiper-registration">Back to swiper registration</Link>
        </Button>
      </Surface>
    </main>
  )
}
