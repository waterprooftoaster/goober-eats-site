/**
 * @file layout.tsx
 * @description Layout guard for the /swiper/* route group; redirects non-swipers to registration.
 *   Called by: Next.js App Router (wraps all /swiper routes)
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts
 */

import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api/helpers'
import { redirect } from 'next/navigation'

/**
 * Guards swiper routes; redirects unauthenticated users to login and non-swipers to registration.
 * @param children - Swiper page content
 * @returns Children if the user is an active swiper
 * @called-by Next.js App Router
 */
export default async function SwiperLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_swiper')
    .eq('id', user.id)
    .single()

  if (!profile?.is_swiper) redirect('/swiper-registration')

  return <>{children}</>
}
