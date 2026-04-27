/**
 * @file page.tsx
 * @description Home page entry point. Unauthenticated visitors see the cover/landing
 *   page; authenticated users see the upload-cart-screenshot home experience.
 *   Gating is a server-component branch — no middleware redirect, no client check.
 *   Called by: Next.js routing (/)
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts,
 *   components/cover-page.tsx, components/home-upload.tsx
 */

import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api/helpers'
import CoverPage from '@/components/cover-page'
import HomeUpload from '@/components/home-upload'

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
      return <HomeUpload />
    }
  }

  const { data: schools } = await supabase
    .from('schools')
    .select('id, name')
    .order('name')

  return <CoverPage schools={schools ?? []} />
}
