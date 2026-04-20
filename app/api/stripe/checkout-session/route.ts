/**
 * @file route.ts
 * @description POST endpoint that creates a Stripe embedded Checkout session from the caller's cart.
 *   Supports both authenticated and guest users through a unified code path.
 *   Called by: components/checkout-form.tsx
 * @dependencies lib/stripe/client.ts, lib/cart/load.ts, lib/pricing.ts, lib/api/helpers.ts
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripe } from '@/lib/stripe/client'
import { loadCart } from '@/lib/cart/load'
import { platformFeeCents } from '@/lib/pricing'
import { apiError, apiSuccess, getAuthenticatedUser, CART_SESSION_COOKIE } from '@/lib/api/helpers'

const checkoutBodySchema = z.object({
  tip_cents: z.number().int().min(0).max(10000).optional(),
  special_instructions: z.string().trim().max(500).optional(),
  guest_name: z.string().trim().min(1).max(100).optional(),
})

// M-1: Guest session cookie must be a v4 UUID
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Creates a Stripe embedded Checkout session from the caller's current cart.
 * @returns JSON { clientSecret } for the Stripe.js embedded form; 400/500 on invalid cart or Stripe error
 * @called-by components/checkout-form.tsx
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = checkoutBodySchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400)
  }
  const { tip_cents, special_instructions, guest_name } = parsed.data

  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  const cookieStore = await cookies()
  const service = createServiceClient()

  // Find the user's cart
  let cart: { id: string; eatery_id: string } | null = null
  if (user) {
    const { data } = await service
      .from('carts')
      .select('id, eatery_id')
      .eq('user_id', user.id)
      .maybeSingle()
    cart = data
  } else {
    const sessionId = cookieStore.get(CART_SESSION_COOKIE)?.value
    if (!sessionId) return apiError('No cart found', 400)
    if (!UUID_RE.test(sessionId)) return apiError('Invalid session', 400)
    const { data } = await service
      .from('carts')
      .select('id, eatery_id')
      .eq('session_id', sessionId)
      .maybeSingle()
    cart = data
  }

  if (!cart) return apiError('No cart found', 400)

  const loaded = await loadCart(service, cart)
  if (loaded.items.length === 0) return apiError('Cart is empty', 400)

  if (!user && !guest_name) {
    return apiError('Guest checkout requires a name', 400)
  }

  // Pricing: user pays 50% of original (already computed in loadCart)
  const totalItemCents = loaded.items.reduce(
    (sum, item) => sum + item.quantity * item.price_cents,
    0
  )
  const tipCents = Math.min(tip_cents ?? 0, totalItemCents)
  const totalCents = totalItemCents + tipCents
  const feeCents = platformFeeCents(totalItemCents)

  const appUrl = process.env.NEXT_PUBLIC_URL
  if (!appUrl || !appUrl.startsWith('http')) {
    return apiError('Server configuration error', 500)
  }
  const returnUrl = `${appUrl}/checkout/return?session_id={CHECKOUT_SESSION_ID}`

  const lineItems = loaded.items.map((item) => ({
    price_data: {
      currency: 'usd',
      unit_amount: item.price_cents,
      product_data: { name: item.name },
    },
    quantity: item.quantity,
  }))

  // Unified metadata — goes on both session and PI
  const metadata: Record<string, string> = {
    cart_id: cart.id,
    eatery_id: loaded.eatery_id,
    tip_cents: String(tipCents),
    special_instructions: special_instructions ?? '',
    platform_fee_cents: String(feeCents),
    total_cents: String(totalCents),
  }

  if (user) {
    metadata.orderer_id = user.id
  } else {
    metadata.is_guest = 'true'
    metadata.guest_name = guest_name!
  }

  let session
  try {
    session = await getStripe().checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'payment',
      return_url: returnUrl,
      metadata,
      line_items: lineItems,
      payment_intent_data: { metadata },
      ...(user?.email && { customer_email: user.email }),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe error'
    console.error(`Failed to create Stripe checkout session: ${message}`)
    return apiError('Failed to create checkout session', 500)
  }

  if (!session.client_secret) {
    return apiError('Failed to create checkout session', 500)
  }

  return apiSuccess({ clientSecret: session.client_secret })
}
