/**
 * @file route.ts
 * @description POST endpoint that mints short-lived signed URLs for
 *   cart-screenshot paths the caller already holds (e.g. paths returned by
 *   /api/cart-screenshots/upload-url and stashed in sessionStorage during
 *   /checkout). The orderer cannot sign these client-side because the
 *   `cart-screenshots` Storage RLS policy only allows reads when the path
 *   appears in an existing orders.cart_screenshot_urls row owned by the
 *   caller — and at /checkout time, no order row exists yet (the row is
 *   only inserted by the Stripe payment_intent.succeeded webhook).
 *   Called by: app/checkout/page.tsx (preview)
 * @dependencies lib/supabase/server.ts, lib/storage/sign-screenshots.ts,
 *   lib/api/helpers.ts, lib/types/api.ts
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'
import { signCartScreenshotPaths } from '@/lib/storage/sign-screenshots'
import { screenshotSignSchema } from '@/lib/types/api'

/**
 * Returns signed URLs for the given cart-screenshot paths.
 * @returns JSON { signed_urls: string[] } in input order; 401 unauthenticated, 400 invalid body
 * @called-by app/checkout/page.tsx
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  // Auth gate (anonymous Supabase sessions count). Path entries are random
  // UUIDs anchored to a 60-bit session id; combined with auth this is
  // sufficient — there is no value-add in a per-path ownership check
  // because no order row exists yet to scope against.
  if (!user) return apiError('Unauthorized', 401)

  const body = await request.json().catch(() => null)
  const parsed = screenshotSignSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400)
  }

  const signed_urls = await signCartScreenshotPaths(parsed.data.paths)
  return apiSuccess({ signed_urls })
}
