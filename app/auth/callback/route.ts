/**
 * @file route.ts
 * @description OAuth callback handler for Supabase auth code exchange.
 *   Exchanges the OAuth code for a session, then redirects to onboarding if no profile exists.
 *   Called by: Supabase OAuth redirect (Google sign-in flow)
 * @dependencies lib/supabase/server.ts
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Exchanges the OAuth authorization code for a session and redirects based on profile existence.
 * @returns Redirect to / on success, /auth/login?onboarding=true for new users, or error redirect
 * @called-by Supabase OAuth (Google sign-in)
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single()

        if (!profile) {
          return NextResponse.redirect(`${origin}/auth/login?onboarding=true`)
        }
      }

      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(
    `${origin}/auth/login?error=Could+not+complete+authentication`,
  )
}
