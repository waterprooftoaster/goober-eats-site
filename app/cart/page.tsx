/**
 * @file page.tsx
 * @description Full-page cart view; loads the user's or guest's cart and renders CartPanel.
 *   Called by: Next.js routing (direct navigation to /cart)
 * @dependencies lib/supabase/server.ts, lib/supabase/service.ts, lib/cart/load.ts, components/cart-panel.tsx
 */

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAuthenticatedUser } from '@/lib/api/helpers'
import { loadCart } from '@/lib/cart/load'
import { CartPanel } from '@/components/cart-panel'

/**
 * Loads the current user's or guest's cart and renders it inside CartPanel.
 * @returns CartPanel with loaded cart data, or CartPanel with null if no cart exists
 * @called-by Next.js routing (/cart)
 */
export default async function CartPage() {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  const cookieStore = await cookies()
  const service = createServiceClient()

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
    if (sessionId) {
      const { data } = await service
        .from('carts')
        .select('id, eatery_id')
        .eq('session_id', sessionId)
        .maybeSingle()
      cart = data
    }
  }

  if (!cart) {
    return <CartPanel initialCart={null} />
  }

  const loaded = await loadCart(service, cart)
  return <CartPanel initialCart={loaded} />
}
