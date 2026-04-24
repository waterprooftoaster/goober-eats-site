/**
 * @file page.tsx
 * @description Stripe Connect onboarding completion page; syncs Stripe account status directly,
 *   auto-activates the swiper, and redirects to home. Shows a fallback if setup is incomplete.
 *   Called by: Stripe Connect returnUrl after onboarding
 * @dependencies lib/supabase/server.ts, lib/supabase/service.ts, lib/stripe/client.ts
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripe } from '@/lib/stripe/client'

/**
 * Syncs the Stripe Connect account status, activates the swiper profile if complete, and redirects.
 * @returns Fallback "Almost there" page if onboarding or school setup is incomplete
 * @called-by Stripe Connect returnUrl
 */
export default async function StripeOnboardCompletePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stripeRow } = await supabase
    .from('stripe_accounts')
    .select('stripe_account_id, onboarding_complete')
    .eq('user_id', user.id)
    .maybeSingle()

  // Sync Stripe status directly to avoid webhook race condition:
  // the account.updated webhook may not have arrived yet when the user
  // is redirected back here, so we check Stripe directly and update the DB.
  const serviceClient = createServiceClient()
  let onboardingComplete = stripeRow?.onboarding_complete ?? false
  if (stripeRow && !onboardingComplete) {
    try {
      const account = await getStripe().accounts.retrieve(stripeRow.stripe_account_id)
      if (account.details_submitted && account.charges_enabled) {
        console.log(`[fallback-api] stripe sync: ${stripeRow.stripe_account_id}`)
        await serviceClient
          .from('stripe_accounts')
          .update({ onboarding_complete: true })
          .eq('stripe_account_id', stripeRow.stripe_account_id)
        onboardingComplete = true
      }
    } catch {
      // non-fatal: the webhook will update the DB if this call fails
    }
  }

  // Auto-activate swiper if school is set and onboarding is complete
  if (onboardingComplete) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('school_id, is_swiper')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('onboard/complete: failed to fetch profile', profileError)
    }

    if (profile?.school_id && !profile.is_swiper) {
      await serviceClient
        .from('profiles')
        .update({ is_swiper: true })
        .eq('id', user.id)
        .eq('is_swiper', false)
    }

    redirect('/?notice=swiper_activated')
  }

  // Fallback: onboarding not yet complete or school not set
  return (
    <main data-testid="onboard-almost-there-page" className="min-h-screen bg-white">
      <div className="mx-auto max-w-md p-8">
        <h1 className="text-2xl font-bold mb-4">Almost there!</h1>
        <p className="text-gray-600 mb-8">
          Your payment account setup is still being processed. Please complete
          your school selection to finish registration.
        </p>
        <Link
          href="/swiper-registration"
          className="inline-block rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          Return to swiper registration
        </Link>
      </div>
    </main>
  )
}
