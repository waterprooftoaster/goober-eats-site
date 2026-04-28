/**
 * @file route.ts
 * @description GET endpoint listing the authenticated user's orders, filterable by role and status.
 *   Called by: app/orders/page.tsx, app/current-orders/page.tsx
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'
import { signCartScreenshotPaths } from '@/lib/storage/sign-screenshots'

/**
 * Lists orders for the authenticated user, with optional role and status filters.
 * @returns JSON array of order rows; 401 if unauthenticated
 * @called-by app/orders/page.tsx, app/current-orders/page.tsx
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) return apiError('Unauthorized', 401)

  const { searchParams } = request.nextUrl
  const role = searchParams.get('role')
  const status = searchParams.get('status')
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1), 100)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)

  let query = supabase.from('orders').select(
    'id, orderer_id, swiper_id, school_id, restaurant_name, cart_screenshot_urls, status, subtotal_cents, total_cents, guest_name, guest_phone, created_at, updated_at'
  )

  if (role === 'orderer') {
    query = query.eq('orderer_id', user.id)
  } else if (role === 'swiper') {
    query = query.eq('swiper_id', user.id)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data: orders, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return apiError('Failed to fetch orders', 500)

  const signed = await Promise.all(
    (orders ?? []).map(async (row) => ({
      ...row,
      cart_screenshot_urls: await signCartScreenshotPaths(
        (row.cart_screenshot_urls as string[] | null) ?? []
      ),
    }))
  )
  return apiSuccess(signed)
}
