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
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('auth/callback: exchangeCodeForSession failed', error)
    return NextResponse.redirect(new URL('/auth/login?error=Could not complete authentication', url.origin))
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
