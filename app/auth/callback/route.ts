/**
 * @file route.ts
 * @description GET handler that completes a Supabase email-link flow:
 *   exchanges the `code` query parameter for a session and redirects the
 *   user to `next` (defaulting to `/`). Used by both the email-confirm
 *   link sent on signup and the recovery link sent on password reset.
 *   Called by: Supabase Auth (email link `redirect_to` URL)
 * @dependencies lib/supabase/server.ts
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Completes the PKCE code exchange and redirects to `next` on success.
 * @param request - Incoming GET request carrying ?code and optional ?next
 * @returns 302 redirect to the resolved next URL or to /auth/login on error
 * @called-by Supabase Auth email-link flow
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const nextParam = url.searchParams.get('next')

  // Only accept relative paths for `next` to prevent open-redirects via
  // crafted email links.
  const next = nextParam && nextParam.startsWith('/') ? nextParam : '/'

  if (!code) {
    return NextResponse.redirect(new URL('/auth/login?error=Could not complete authentication', url.origin))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('auth/callback: exchangeCodeForSession failed', error)
    return NextResponse.redirect(new URL('/auth/login?error=Could not complete authentication', url.origin))
  }

  // Auto-create the profile using metadata stored at sign-up time. Best-effort:
  // if the insert fails (e.g. profile already exists on a password-reset flow,
  // or the school was deleted), the login page's initialOnboarding resume path
  // will catch it and ask the user to complete their profile again.
  const user = data.user
  const fullName = typeof user?.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name : null
  const schoolId = typeof user?.user_metadata?.school_id === 'string'
    ? user.user_metadata.school_id : null

  if (fullName && user?.email) {
    await supabase.from('profiles').insert({
      id: user.id,
      full_name: fullName,
      email: user.email,
      school_id: schoolId ?? null,
    })
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
