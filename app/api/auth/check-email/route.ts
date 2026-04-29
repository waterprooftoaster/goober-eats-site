/**
 * @file route.ts
 * @description GET endpoint that checks if an email address is already registered.
 *   Includes a fixed 300ms delay to mitigate timing-based email enumeration attacks.
 *   Called by: auth/login form to drive sign-in vs sign-up UX split
 * @dependencies lib/supabase/service.ts, lib/api/helpers.ts
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { apiError, apiSuccess } from '@/lib/api/helpers'

const querySchema = z.object({
  email: z.string().email(),
})

/**
 * Checks if the given email address is already registered.
 * @returns JSON { data: { exists: boolean } } — always 200; 400 on invalid email
 * @called-by auth/login form
 */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    email: request.nextUrl.searchParams.get('email'),
  })

  if (!parsed.success) {
    return apiError('Invalid email address', 400)
  }

  // Fixed-deadline delay to mitigate timing-based email enumeration.
  // The response always takes >= 300ms regardless of DB lookup speed.
  // NOTE: This endpoint intentionally reveals email existence to drive the
  // sign-in vs sign-up UX split. IP-based rate limiting should be added
  // when a rate-limiting infrastructure is in place to prevent bulk enumeration.
  const deadline = new Promise((r) => setTimeout(r, 300))

  // Service client: the check_email_exists RPC inspects auth.users, which is
  // not exposed to the anon role under default Supabase RLS. The RPC itself
  // is SECURITY DEFINER and accepts only an email arg, so the bypass is
  // narrowly scoped to "does this email exist?"
  const serviceClient = createServiceClient()
  const [result] = await Promise.all([
    serviceClient.rpc('check_email_exists', { lookup_email: parsed.data.email }),
    deadline,
  ])

  if (result.error) {
    return apiError('Unable to verify email', 500)
  }

  return apiSuccess({ exists: result.data as boolean })
}
