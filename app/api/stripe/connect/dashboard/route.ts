/**
 * @file route.ts
 * @description POST endpoint that generates a Stripe Express dashboard login link for a onboarded swiper.
 *   Called by: app/account/swiper-section.tsx
 * @dependencies lib/supabase/server.ts, lib/stripe/connect.ts, lib/api/helpers.ts
 */

import { createClient } from '@/lib/supabase/server'
import { createLoginLink } from '@/lib/stripe/connect'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'

/**
 * Generates a Stripe Express dashboard login link for a fully onboarded swiper.
 * @returns JSON { url } for the Stripe dashboard; 400/401 if not onboarded or unauthenticated
 * @called-by app/account/swiper-section.tsx
 */
export async function POST() {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) return apiError('Unauthorized', 401)

  const { data: account } = await supabase
    .from('stripe_accounts')
    .select('stripe_account_id, onboarding_complete')
    .eq('user_id', user.id)
    .single()

  if (!account?.onboarding_complete) return apiError('Stripe onboarding not complete', 400)

  let link
  try {
    link = await createLoginLink(account.stripe_account_id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create dashboard link'
    return apiError(message, 500)
  }

  return apiSuccess({ url: link.url })
}
