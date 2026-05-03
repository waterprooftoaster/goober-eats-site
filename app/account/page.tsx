/**
 * @file page.tsx
 * @description /account server component. Fetches profile + stripe_accounts
 *   + schools in parallel, then hands off to <AccountPanel /> which renders
 *   inside the S03 <Modal> primitive. Anonymous users redirect to login.
 *   Called by: Next.js routing (/account); header avatar link.
 * @dependencies lib/supabase/server.ts, components/account-panel
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountPanel } from '@/components/account-panel'

/**
 * Server-side data prefetch for the account modal. All three queries run
 * in parallel; missing profile rows fall through to the orderer view (the
 * "Become a swiper" CTA).
 * @returns The AccountPanel element
 * @called-by Next.js App Router (/account)
 */
export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [profileResult, stripeResult, schoolsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('is_swiper, school_id, full_name')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('stripe_accounts')
      .select('onboarding_complete')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('schools').select('id, name').order('name'),
  ])

  const profile = profileResult.data ?? { is_swiper: false, school_id: null, full_name: null }
  const stripeAccount = stripeResult.data ?? null
  const schools = schoolsResult.data ?? []

  return (
    <AccountPanel
      email={user.email ?? ''}
      fullName={profile.full_name ?? null}
      profile={profile}
      stripeAccount={stripeAccount}
      schools={schools}
    />
  )
}
