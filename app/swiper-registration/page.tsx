/**
 * @file page.tsx
 * @description /swiper-registration page: server-fetches profile + schools,
 *   redirects out if user is anonymous / mid-onboarding / already a swiper,
 *   otherwise renders the two-step registration form (school → Stripe).
 *   Called by: Next.js routing (/swiper-registration); /account become-swiper
 *   CTA; /swiper/layout's redirect target.
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts,
 *   ./swiper-registration-form
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api/helpers'
import { SwiperRegistrationForm } from './swiper-registration-form'

/**
 * Server-side page wrapper for swiper registration. Resolves auth state
 * and redirects appropriately before handing off to the client form.
 * @returns The page element, or a redirect.
 * @called-by Next.js App Router (/swiper-registration)
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
  const currentSchool = profile.school_id
    ? schools.find((s) => s.id === profile.school_id) ?? null
    : null

  return (
    <main
      data-testid="swiper-registration-page"
      className="mx-auto max-w-md py-16 px-6 sm:py-24"
    >
      <SwiperRegistrationForm
        schoolId={profile.school_id ?? null}
        schoolName={currentSchool?.name ?? null}
        schools={schools}
      />
    </main>
  )
}
