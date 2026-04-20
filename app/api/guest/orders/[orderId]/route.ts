/**
 * @file route.ts
 * @description PATCH endpoint for guests to associate an anonymous user ID with their order.
 *   Called by: guest checkout return flow
 * @dependencies lib/supabase/service.ts, lib/api/guest-auth.ts, lib/api/helpers.ts
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { validateGuestOrder } from '@/lib/api/guest-auth'
import { apiError, apiSuccess } from '@/lib/api/helpers'

const patchBodySchema = z.object({
  anon_user_id: z.string().uuid(),
})

/**
 * Associates an anonymous user ID with a guest order (idempotent on the same ID; 409 on mismatch).
 * @param params - Route params containing the order UUID
 * @returns 200 on success; 400/401/403/409 on validation or conflict
 * @called-by guest checkout return flow
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params

  const auth = await validateGuestOrder(orderId)
  if (auth.error) return auth.error

  const body = await request.json()
  const parsed = patchBodySchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400)
  }
  const { anon_user_id } = parsed.data

  const supabase = createServiceClient()

  // Fetch current anon_user_id to handle idempotency and prevent hijacking
  const { data: order } = await supabase
    .from('orders')
    .select('anon_user_id')
    .eq('id', orderId)
    .single()

  if (order?.anon_user_id !== null && order?.anon_user_id !== undefined) {
    if (order.anon_user_id === anon_user_id) {
      return apiSuccess({ orderId })
    }
    return apiError('Conflict: anon_user_id already set', 409)
  }

  const { error } = await supabase
    .from('orders')
    .update({ anon_user_id })
    .eq('id', orderId)

  if (error) {
    return apiError('Failed to update order', 500)
  }

  return apiSuccess({ orderId })
}
