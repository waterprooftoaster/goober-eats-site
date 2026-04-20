/**
 * @file page.tsx
 * @description Swiper registration page; fetches user profile and schools, then renders the registration form.
 *   Redirects swipers already registered to /account.
 *   Called by: Next.js routing (direct navigation to /swiper-registration)
 * @dependencies lib/supabase/server.ts, app/swiper-registration/swiper-registration-form.tsx
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api/helpers'
import { SwiperRegistrationForm } from './swiper-registration-form'

/**
 * Fetches profile and available schools, then renders SwiperRegistrationForm.
 * @returns SwiperRegistrationForm; redirects to /auth/login, /auth/login?onboarding=true, or /account as appropriate
 * @called-by Next.js routing (/swiper-registration)
 */
export default async function SwiperRegistrationPage() {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) redirect('/auth/login')

  const [profileResult, schoolsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('school_id, is_swiper')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.from('schools').select('id, name').order('name'),
  ])

  if (schoolsResult.error) {
    throw new Error(`Failed to load schools: ${schoolsResult.error.message}`)
  }

  const profile = profileResult.data
  if (!profile) redirect('/auth/login?onboarding=true')
  if (profile.is_swiper) redirect('/account')

  const schools = schoolsResult.data
  const currentSchool = profile?.school_id
    ? schools.find((s) => s.id === profile.school_id) ?? null
    : null

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-md p-8">
        <SwiperRegistrationForm
          schoolId={profile?.school_id ?? null}
          schoolName={currentSchool?.name ?? null}
          schools={schools}
        />
      </div>
    </main>
  )
}
