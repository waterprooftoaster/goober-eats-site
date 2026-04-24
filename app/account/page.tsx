/**
 * @file page.tsx
 * @description Full-page account view; fetches profile, Stripe account, and schools, then renders AccountPanel.
 *   Called by: Next.js routing (direct navigation to /account)
 * @dependencies lib/supabase/server.ts, components/account-panel.tsx
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountPanel } from '@/components/account-panel'

/**
 * Fetches the authenticated user's profile, Stripe account status, and available schools.
 * @returns AccountPanel component; redirects to /auth/login if unauthenticated
 * @called-by Next.js routing (/account)
 */
export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const [profileResult, stripeResult, schoolsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('is_swiper, school_id')
      .eq('id', user.id)
      .single(),
    supabase
      .from('stripe_accounts')
      .select('onboarding_complete, charges_enabled, payouts_enabled, disabled_reason, currently_due')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('schools').select('id, name').order('name'),
  ])

  const profile = profileResult.data ?? { is_swiper: false, school_id: null }
  const stripeAccount = stripeResult.data ?? null
  const schools = schoolsResult.data ?? []

  return (
    <AccountPanel
      email={user.email ?? ''}
      profile={profile}
      stripeAccount={stripeAccount}
      schools={schools}
    />
  )
}
