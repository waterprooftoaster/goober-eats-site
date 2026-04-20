/**
 * @file route.ts
 * @description GET endpoint returning the full enriched cart for the current user or guest session.
 *   Called by: app/cart/page.tsx, components/cart-panel.tsx
 * @dependencies lib/supabase/server.ts, lib/supabase/service.ts, lib/cart/load.ts, lib/api/helpers.ts
 */

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'
import { loadCart } from '@/lib/cart/load'

/**
 * Returns the full enriched cart (eatery info, items, options) for the current user or guest.
 * @returns JSON { data: { cart: LoadedCart | null } }
 * @called-by app/cart/page.tsx, components/cart-panel.tsx
 */
export async function GET() {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  const cookieStore = await cookies()
  const service = createServiceClient()

  // Find cart for this identity
  let cart: { id: string; eatery_id: string } | null = null
  if (user) {
    const { data } = await service
      .from('carts')
      .select('id, eatery_id')
      .eq('user_id', user.id)
      .maybeSingle()
    cart = data
  } else {
    const sessionId = cookieStore.get('cart_session_id')?.value
    if (!sessionId) return apiSuccess({ cart: null })

    const { data } = await service
      .from('carts')
      .select('id, eatery_id')
      .eq('session_id', sessionId)
      .maybeSingle()
    cart = data
  }

  if (!cart) return apiSuccess({ cart: null })

  const loaded = await loadCart(service, cart)
  return apiSuccess({ cart: loaded })
}
