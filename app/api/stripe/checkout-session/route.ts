/**
 * @file route.ts
 * @description POST endpoint that creates a Stripe embedded Checkout session
 *   from the GrubHub-screenshot pivot inputs (restaurant name, 1..5 cart
 *   screenshot paths, orderer-entered total). Supports authenticated and
 *   guest checkouts. Platform receives the full charge; the 10% platform fee
 *   is recorded on the payments row at order creation time and `transfer.ts`
 *   moves the net to the swiper's connected account on completion.
 *
 *   Note on Stripe fee semantics: `application_fee_amount` requires
 *   `transfer_data.destination` or `on_behalf_of`, neither of which we can
 *   set at checkout (the swiper is unknown until accept). The two-step
 *   transfer model is the only practical fit and matches the existing
 *   `lib/stripe/transfer.ts` flow.
 *
 *   Called by: app/checkout/page.tsx
 * @dependencies lib/stripe/client.ts, lib/supabase/server.ts, lib/supabase/service.ts,
 *               lib/api/helpers.ts, lib/types/api.ts
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripe } from '@/lib/stripe/client'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'
import { createCheckoutSchema } from '@/lib/types/api'

// Stripe per-field metadata cap is 500 chars; we guard at 450 to keep the
// joined path list comfortably under, with margin for future fields.
const METADATA_PATHS_MAX_CHARS = 450

/**
 * Creates a Stripe embedded Checkout session for the GrubHub-screenshot order.
 * @returns JSON { clientSecret } for the Stripe.js embedded form; 400 on validation failures, 500 on Stripe errors
 * @called-by app/checkout/page.tsx
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = createCheckoutSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400)
  }
  const {
    restaurant_name,
    cart_screenshot_paths,
    total_cents,
    school_id: bodySchoolId,
    guest_name,
  } = parsed.data

  const joinedPaths = cart_screenshot_paths.join(',')
  if (joinedPaths.length > METADATA_PATHS_MAX_CHARS) {
    return apiError('Too many or too long screenshot paths for Stripe metadata', 400)
  }

  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)

  // Resolve school_id and orderer identity. Anonymous sessions (from home-page
  // signInAnonymously) have a Supabase user but no profile; treat them as guests.
  let realAuthProfile: { school_id: string } | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.school_id) realAuthProfile = profile as { school_id: string }
  }

  let schoolId: string
  if (realAuthProfile) {
    schoolId = realAuthProfile.school_id
  } else {
    if (!guest_name) return apiError('Guest checkout requires a name', 400)
    // Use the body-supplied school_id or fall back to the deployment default.
    const resolvedSchoolId = bodySchoolId ?? process.env.DEFAULT_SCHOOL_ID
    if (!resolvedSchoolId) return apiError('School not configured', 500)
    const service = createServiceClient()
    const { data: school } = await service
      .from('schools')
      .select('id')
      .eq('id', resolvedSchoolId)
      .maybeSingle()
    if (!school) return apiError('Unknown school', 400)
    schoolId = resolvedSchoolId
  }

  const platformFeeCents = Math.round(total_cents * 0.10)

  const appUrl = process.env.NEXT_PUBLIC_URL
  if (!appUrl || !appUrl.startsWith('http')) {
    return apiError('Server configuration error', 500)
  }
  const returnUrl = `${appUrl}/checkout/return?session_id={CHECKOUT_SESSION_ID}`

  const lineItems = [
    {
      price_data: {
        currency: 'usd',
        unit_amount: total_cents,
        product_data: { name: restaurant_name },
      },
      quantity: 1,
    },
  ]

  // Unified metadata — applied to both session and payment_intent_data so the
  // webhook handler can recover full order context from the PI alone.
  const metadata: Record<string, string> = {
    school_id: schoolId,
    restaurant_name,
    cart_screenshot_paths: joinedPaths,
    total_cents: String(total_cents),
    platform_fee_cents: String(platformFeeCents),
  }

  if (realAuthProfile && user) {
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
      ...(realAuthProfile && user?.email && { customer_email: user.email }),
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
