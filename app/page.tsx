/**
 * @file page.tsx
 * @description Home page entry point. Unauthenticated visitors see the cover/landing
 *   page; authenticated users see the upload-cart-screenshot home experience.
 *   Gating is a server-component branch — no middleware redirect, no client check.
 *   Called by: Next.js routing (/)
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts,
 *   components/cover-page.tsx, components/home-upload.tsx
 */

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api/helpers'
import { resolvePrincipal } from '@/lib/auth/resolve-principal'
import CoverPage from '@/components/cover-page'
import HomeUpload from '@/components/home-upload'
import { HomeRefresh } from './home-refresh'

/**
 * Renders the cover page for anon users; the upload-cart home for authed users.
 * @returns Cover page (anon) or HomeUpload (authed)
 * @called-by Next.js routing (/)
 */
export default async function HomePage() {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)

  // Only real (non-anonymous) authed users with a profile.school_id may see
  // the upload home. Anon sessions (created by HomeUpload before checkout)
  // have no profile row → they belong on the cover until they pick a school.
  if (user && !user.is_anonymous) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.school_id) {
      const principal = await resolvePrincipal(supabase, await cookies())
      const isSwiper =
        principal.kind === 'authed_swiper' || principal.kind === 'authed_swiper_pre_stripe'
      let pendingOrderCount = 0
      if (principal.kind === 'authed_swiper') {
        const { count } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open')
          .eq('school_id', principal.schoolId)
        pendingOrderCount = count ?? 0
      }
      return (
        <>
          <HomeRefresh />
          <HomeUpload isSwiper={isSwiper} pendingOrderCount={pendingOrderCount} />
        </>
      )
    }
  }

  const { data: schools } = await supabase
    .from('schools')
    .select('id, name')
    .order('name')

  return (
    <>
      <HomeRefresh />
      <CoverPage schools={schools ?? []} />
    </>
  )
}
