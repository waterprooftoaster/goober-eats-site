/**
 * @file route.ts
 * @description GET endpoint returning open, unaccepted orders for the active
 *   swiper's school. School is resolved server-side from the swiper's profile
 *   to prevent spoofing; orders.school_id is the source of truth post-pivot.
 *   Called by: app/swiper/orders/pending-orders-list.tsx
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts
 */

import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess, getAuthenticatedSwiper } from '@/lib/api/helpers'
import { signCartScreenshotPathsBatch } from '@/lib/storage/sign-screenshots'

/**
 * Returns open, unaccepted orders for the active swiper's school, oldest first.
 * @returns JSON array of order rows (restaurant_name, cart_screenshot_urls, etc.); 401/403 on auth/role failures
 * @called-by app/swiper/orders/pending-orders-list.tsx
 */
export async function GET() {
  const supabase = await createClient()
  const user = await getAuthenticatedSwiper(supabase)
  if (!user) return apiError('Unauthorized', 401)

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_swiper, school_id')
    .eq('id', user.id)
    .single()
  if (!profile?.is_swiper) return apiError('Forbidden', 403)
  // No school set — return empty rather than error; swiper should set a school.
  if (!profile.school_id) return apiSuccess([])

  // Pending unaccepted orders for the swiper's school, oldest first (fair queue).
  // RLS double-checks school scoping; this filter narrows server-side too.
  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, restaurant_name, subtotal_cents, cart_screenshot_urls, created_at'
    )
    .eq('status', 'open')
    .is('swiper_id', null)
    .eq('school_id', profile.school_id)
    .order('created_at', { ascending: true })

  if (error) return apiError('Failed to fetch pending orders', 500)

  // Batch every row's paths into one createSignedUrls RPC, then regroup.
  const allPaths = (orders ?? []).flatMap(
    (row) => (row.cart_screenshot_urls as string[]) ?? []
  )
  const urlByPath = await signCartScreenshotPathsBatch(allPaths)
  const signed = (orders ?? []).map((row) => ({
    ...row,
    cart_screenshot_urls: ((row.cart_screenshot_urls as string[]) ?? [])
      .map((p) => urlByPath.get(p))
      .filter((u): u is string => typeof u === 'string'),
  }))
  return apiSuccess(signed)
}
