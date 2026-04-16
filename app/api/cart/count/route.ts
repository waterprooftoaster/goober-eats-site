/**
 * @file route.ts
 * @description Lightweight GET endpoint returning the total cart item count for the current
 *   user or guest session. Used by HeaderCartButton to refresh the badge after client-side mutations.
 *   Called by: components/header-cart-button.tsx (on cart-updated window event)
 * @dependencies lib/supabase/server.ts, lib/supabase/service.ts, lib/api/helpers.ts
 */
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'

/**
 * Returns the total quantity of items in the current user's or guest's cart.
 * @returns JSON { data: { count: number } } — always 200, count is 0 when no cart exists
 * @called-by components/header-cart-button.tsx
 */
export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  const cookieStore = await cookies()
  const service = createServiceClient()

  let cartId: string | null = null

  if (user) {
    const { data } = await service
      .from('carts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    cartId = data?.id ?? null
  } else {
    const sessionId = cookieStore.get('cart_session_id')?.value
    if (!sessionId) return apiSuccess({ count: 0 })
    const { data } = await service
      .from('carts')
      .select('id')
      .eq('session_id', sessionId)
      .maybeSingle()
    cartId = data?.id ?? null
  }

  if (!cartId) return apiSuccess({ count: 0 })

  const { data: items } = await service
    .from('cart_items')
    .select('quantity')
    .eq('cart_id', cartId)

  const count = (items ?? []).reduce((sum, i) => sum + (i.quantity as number), 0)
  return apiSuccess({ count })
}
