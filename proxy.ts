/**
 * @file proxy.ts
 * @description Thin wrapper that runs Supabase session refresh middleware on every request.
 *   Also stamps x-pathname on each response so Server Components (e.g. layout.tsx)
 *   can read the current route via headers().
 *   Called by: Next.js edge runtime
 */

import { updateSession } from '@/lib/supabase/middleware'
import type { NextRequest } from 'next/server'

/**
 * Refreshes the Supabase session and exposes the current pathname as x-pathname.
 * @param request - Incoming edge request
 * @returns Response with refreshed session cookies and x-pathname header
 * @called-by Next.js edge runtime
 */
export async function proxy(request: NextRequest) {
  const response = await updateSession(request)
  response.headers.set('x-pathname', request.nextUrl.pathname)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
