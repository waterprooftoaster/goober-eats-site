/**
 * @file guest-auth.ts
 * @description Validates guest order tokens from cookies for all guest-facing API endpoints.
 *   Called by: app/api/guest/orders/[orderId]/route.ts, app/api/guest/verify-order/route.ts
 * @dependencies lib/supabase/service.ts
 */

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Cookie name for the guest order token scoped to a specific order. */
export function guestOrderCookieName(orderId: string): string {
  return `guest_order_token_${orderId}`
}

interface GuestOrderValid {
  order: { id: string; guest_access_token: string; orderer_id: null }
  error: null
}
interface GuestOrderInvalid {
  order: null
  error: NextResponse
}
export type GuestAuthResult = GuestOrderValid | GuestOrderInvalid

/**
 * Validates that the caller is a guest with a valid cookie for the given orderId.
 * Returns the order row on success or an error Response on failure.
 *
 * Used by all guest API endpoints — eliminates duplicated auth logic.
 */
export async function validateGuestOrder(orderId: string): Promise<GuestAuthResult> {
  if (!UUID_RE.test(orderId)) {
    return { order: null, error: NextResponse.json({ error: 'Invalid order ID' }, { status: 400 }) }
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(guestOrderCookieName(orderId))?.value

  if (!token) {
    return { order: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const supabase = createServiceClient()
  const { data: order, error: queryError } = await supabase
    .from('orders')
    .select('id, guest_access_token, orderer_id')
    .eq('id', orderId)
    .maybeSingle()

  if (queryError) {
    console.error('validateGuestOrder: query failed', { orderId, error: queryError })
    return { order: null, error: NextResponse.json({ error: 'Server error' }, { status: 500 }) }
  }

  if (!order) {
    return { order: null, error: NextResponse.json({ error: 'Order not found' }, { status: 404 }) }
  }

  // Reject if token doesn't match or if this is an authenticated user's order
  if (order.guest_access_token !== token || order.orderer_id !== null) {
    return { order: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { order: order as GuestOrderValid['order'], error: null }
}
