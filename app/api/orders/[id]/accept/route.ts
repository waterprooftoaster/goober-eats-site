/**
 * @file route.ts
 * @description PATCH endpoint for swipers to atomically claim an open order.
 *   Runs eligibility checks via the user client then uses the service client for
 *   the atomic swiper_id claim (RLS cannot cover the null → user transition).
 *   School scoping reads orders.school_id directly post-pivot (no eateries join).
 *   Uses `canAccept` from lib/stripe/account-state so the gate checks
 *   onboarding_complete AND charges_enabled AND payouts_enabled AND the
 *   absence of a Stripe disabled_reason — not just the legacy onboarding flag.
 *   Called by: swiper orders UI (accept button)
 * @dependencies lib/supabase/server.ts, lib/supabase/service.ts, lib/api/helpers.ts,
 *               lib/stripe/account-state.ts
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'
import { canAccept, humanReason } from '@/lib/stripe/account-state'

/**
 * Atomically claims an open order for the calling swiper after eligibility validation.
 * @param params - Route params containing the order UUID
 * @returns Updated order row on success; 401/403/404/409 on auth, eligibility, or race failures
 * @called-by swiper orders UI (accept button)
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) return apiError('Unauthorized', 401)

  const { data: order } = await supabase
    .from('orders')
    .select('id, orderer_id, swiper_id, school_id, status')
    .eq('id', id)
    .single()

  if (!order) return apiError('Order not found', 404)
  if (order.status !== 'open' || order.swiper_id !== null) {
    return apiError('Order is no longer available', 409)
  }
  if (order.orderer_id === user.id) {
    return apiError('Cannot accept your own order', 403)
  }

  const { data: stripeAccount } = await supabase
    .from('stripe_accounts')
    .select('onboarding_complete, charges_enabled, payouts_enabled, disabled_reason, currently_due')
    .eq('user_id', user.id)
    .single()

  if (!stripeAccount) {
    return apiError('Stripe onboarding must be completed first', 403)
  }

  const accountState = {
    onboardingComplete: stripeAccount.onboarding_complete,
    chargesEnabled: stripeAccount.charges_enabled,
    payoutsEnabled: stripeAccount.payouts_enabled,
    disabledReason: stripeAccount.disabled_reason,
    currentlyDue: stripeAccount.currently_due,
  }

  if (!canAccept(accountState)) {
    const reason =
      humanReason(stripeAccount.disabled_reason) ??
      'Your Stripe account cannot accept transfers right now'
    return apiError(reason, 403)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_swiper, school_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.is_swiper) {
    return apiError('You must be a registered swiper to accept orders', 403)
  }
  if (!profile.school_id) {
    return apiError('You must select a school before accepting orders', 403)
  }

  // School scoping (post-pivot): the order itself carries school_id, no
  // eateries join needed.
  if (order.school_id !== profile.school_id) {
    return apiError('This order is not from your school', 403)
  }

  // Atomic update — uses service client to bypass RLS (the accept operation sets
  // swiper_id from null to the accepting user; no RLS policy covers this "claim"
  // transition). All authorization checks above use the user client to ensure
  // the swiper is eligible.
  const service = createServiceClient()
  const { data: updated, error } = await service
    .from('orders')
    .update({ swiper_id: user.id, status: 'in_progress' as const })
    .eq('id', id)
    .eq('status', 'open')
    .is('swiper_id', null)
    .select(
      'id, orderer_id, swiper_id, school_id, restaurant_name, cart_screenshot_urls, status, total_cents, guest_name, guest_phone, created_at, updated_at'
    )
    .single()

  if (error || !updated) {
    return apiError('Order was already accepted by another swiper', 409)
  }

  const { error: convError } = await service
    .from('conversations')
    .insert({
      order_id: updated.id,
      orderer_id: updated.orderer_id,
      swiper_id: user.id,
    })

  // Handle re-acceptance after cancellation (unique violation on order_id)
  if (convError?.code === '23505') {
    await service
      .from('conversations')
      .update({ swiper_id: user.id })
      .eq('order_id', updated.id)
  }

  return apiSuccess(updated)
}
