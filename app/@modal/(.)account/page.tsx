import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountPanel } from '@/components/account-panel'

export default async function AccountModal() {
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
      .select('onboarding_complete')
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
