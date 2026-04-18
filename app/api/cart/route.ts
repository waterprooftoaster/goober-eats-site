import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'
import { loadCart } from '@/lib/cart/load'

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
