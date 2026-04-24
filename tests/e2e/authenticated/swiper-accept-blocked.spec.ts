/**
 * @file swiper-accept-blocked.spec.ts
 * @description E2E smoke test for finding #4 + #12: a swiper whose Stripe
 *   Connect account has charges_enabled=false must be blocked from
 *   accepting orders, and the API error must surface a plain-English
 *   disabled_reason.
 *   Called by: Playwright "authenticated" project
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const TEST_EMAIL = 'test@goobereats.test'

test.describe('Swiper accept blocked when Stripe Connect is unhealthy', () => {
  let supabase: ReturnType<typeof createClient>
  let userId: string
  let schoolId: string
  let orderId: string
  const stripeAccountId = `acct_blocked_${Date.now()}`

  test.beforeAll(async () => {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    const { data: school } = await supabase.from('schools').select('id').limit(1).single()
    if (!school) throw new Error('No schools found')
    schoolId = school.id as string

    const {
      data: { users },
    } = await supabase.auth.admin.listUsers()
    const user = users.find((u) => u.email === TEST_EMAIL)
    if (!user) throw new Error('Test user not found')
    userId = user.id

    await supabase
      .from('profiles')
      .update({ is_swiper: true, school_id: schoolId })
      .eq('id', userId)

    // Seed an unhealthy Stripe account row directly — no real Stripe side
    // effects. onboarding_complete is true to prove the composite gate
    // catches the other flags.
    await supabase.from('stripe_accounts').upsert(
      {
        user_id: userId,
        stripe_account_id: stripeAccountId,
        onboarding_complete: true,
        charges_enabled: false,
        payouts_enabled: false,
        disabled_reason: 'requirements.past_due',
        currently_due: ['individual.dob.day'],
      },
      { onConflict: 'user_id' }
    )

    // Seed an open order from a different orderer in the same school.
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        orderer_id: null,
        school_id: schoolId,
        restaurant_name: 'Blocked Test',
        cart_screenshot_urls: [
          'pre-checkout/ABCdef1234/00000000-0000-4000-8000-000000000ccc.png',
        ],
        stripe_payment_intent_id: `pi_blocked_${Date.now()}`,
        total_cents: 1500,
        guest_name: 'Guest',
        guest_access_token: '00000000-0000-4000-8000-00000000dddd',
      })
      .select('id')
      .single()

    if (error || !order) throw new Error(`Failed to seed order: ${error?.message}`)
    orderId = order.id as string
  })

  test.afterAll(async () => {
    if (orderId) {
      await supabase.from('payments').delete().eq('order_id', orderId)
      await supabase.from('orders').delete().eq('id', orderId)
    }
    await supabase.from('stripe_accounts').delete().eq('user_id', userId)
    await supabase.from('profiles').update({ is_swiper: false }).eq('id', userId)
  })

  test('accept returns 403 and surfaces the Stripe disabled_reason in plain English', async ({
    request,
  }) => {
    const res = await request.fetch(`/api/orders/${orderId}/accept`, {
      method: 'PATCH',
    })

    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/additional information/i)
  })
})
