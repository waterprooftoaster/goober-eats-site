/**
 * @file route.ts
 * @description POST endpoint to create or retrieve a swiper's Stripe Express account and return an onboarding URL.
 *   Handles race-condition duplicate inserts via the 23505 conflict path.
 *   Called by: app/account/swiper-section.tsx (begin Stripe onboarding button)
 * @dependencies lib/supabase/server.ts, lib/stripe/connect.ts, lib/api/helpers.ts
 */

import { createClient } from '@/lib/supabase/server'
import { createExpressAccount, createOnboardingLink } from '@/lib/stripe/connect'
import { apiError, apiSuccess, getAuthenticatedSwiper } from '@/lib/api/helpers'

/**
 * Creates or retrieves the caller's Stripe Express account and returns a fresh onboarding URL.
 * @returns JSON { url } for Stripe onboarding; 400/401/500 on validation or Stripe errors
 * @called-by app/account/swiper-section.tsx (begin onboarding button)
 */
export async function POST() {
  const supabase = await createClient()
  const user = await getAuthenticatedSwiper(supabase)
  if (!user) return apiError('Unauthorized', 401)
  if (!user.email) return apiError('Account must have an email address', 400)

  const appUrl = process.env.NEXT_PUBLIC_URL
  if (!appUrl) return apiError('Server configuration error', 500)

  // Get or create Stripe Connected Account
  let stripeAccountId: string

  const { data: existing } = await supabase
    .from('stripe_accounts')
    .select('stripe_account_id')
    .eq('user_id', user.id)
    .single()

  if (existing) {
    stripeAccountId = existing.stripe_account_id
  } else {
    let account
    try {
      account = await createExpressAccount(user.id, user.email)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create Stripe account'
      return apiError(message, 500)
    }

    const { data: inserted, error } = await supabase
      .from('stripe_accounts')
      .insert({ user_id: user.id, stripe_account_id: account.id })
      .select('stripe_account_id')
      .single()

    if (error?.code === '23505') {
      // Race condition: another request won the insert, fetch theirs
      const { data: raceWinner } = await supabase
        .from('stripe_accounts')
        .select('stripe_account_id')
        .eq('user_id', user.id)
        .single()
      if (!raceWinner) return apiError('Failed to create Stripe account record', 500)
      stripeAccountId = raceWinner.stripe_account_id
    } else if (error) {
      return apiError('Failed to create Stripe account record', 500)
    } else {
      stripeAccountId = inserted.stripe_account_id
    }
  }

  let link
  try {
    link = await createOnboardingLink(
      stripeAccountId,
      `${appUrl}/stripe/onboard/complete`,
      `${appUrl}/stripe/onboard/refresh`
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create onboarding link'
    return apiError(message, 500)
  }

  return apiSuccess({ url: link.url })
}