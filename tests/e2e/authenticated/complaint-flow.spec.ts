/**
 * @file complaint-flow.spec.ts
 * @description Authenticated E2E for the orderer complaint flow. Seeds a
 *   completed order (with payment + completion_photo + completed_at within
 *   the 24-hour window) and walks the orderer through:
 *     1. /orders → "Report a problem" button is rendered.
 *     2. Click → land on the complaint form (eligible state).
 *     3. Submit category + reason → mock adjudicator returns 'escalate'
 *        → result page shows "we're reviewing".
 *     4. /orders re-renders → status pill replaces the button.
 *     5. Re-visit /orders/[id]/complaints/new → ineligible state.
 *   AI_GATEWAY_API_KEY is unset in CI so the adapter returns the deterministic
 *   mock verdict (escalate). No live AI / Stripe network calls.
 *   Called by: Playwright "authenticated" project
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const TEST_EMAIL = 'test@goobereats.edu'
const ORDER_SUBTOTAL_CENTS = 2500
const ORDER_TOTAL_CENTS = 1500
const ORDER_PLATFORM_FEE_CENTS = 250

let userId: string
let orderId: string

test.describe('Orderer complaint flow', () => {
  test.beforeAll(async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .limit(1)
      .single()
    if (!school) throw new Error('No schools found')

    const {
      data: { users },
    } = await supabase.auth.admin.listUsers()
    const user = users.find((u) => u.email === TEST_EMAIL)
    if (!user) throw new Error('Test user not found')
    userId = user.id

    await supabase
      .from('profiles')
      .update({ school_id: school.id })
      .eq('id', userId)

    // Seed a completed order owned by the orderer (orderer_id, not guest).
    // completed_at within the 24-hour window so the complaint is eligible.
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        orderer_id: userId,
        swiper_id: null,
        school_id: school.id,
        restaurant_name: 'Chipotle',
        cart_screenshot_urls: [`pre-checkout/complaint-e2e/${randomUUID()}.png`],
        subtotal_cents: ORDER_SUBTOTAL_CENTS,
        total_cents: ORDER_TOTAL_CENTS,
        status: 'completed',
        completed_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single()
    if (!order) throw new Error(`Failed to create test order: ${orderError?.message}`)
    orderId = order.id

    await supabase.from('payments').insert({
      order_id: orderId,
      stripe_payment_intent_id: `pi_complaint_test_${randomUUID().slice(0, 8)}`,
      amount_cents: ORDER_TOTAL_CENTS,
      platform_fee_cents: ORDER_PLATFORM_FEE_CENTS,
      status: 'succeeded',
      payer_id: userId,
      payee_id: null,
    })

    // Seed conversation + completion_photo so the API's photo lookup path
    // mirrors production. Conversation creation in production is keyed off
    // accept; here we insert directly.
    const { data: conv } = await supabase
      .from('conversations')
      .insert({ order_id: orderId, orderer_id: userId, swiper_id: null })
      .select('id')
      .single()
    if (!conv) throw new Error('Failed to create conversation')

    await supabase.from('messages').insert({
      conversation_id: conv.id,
      sender_id: userId,
      message_type: 'completion_photo',
      image_url: `${orderId}/seed-${randomUUID()}.jpg`,
      body: null,
    })
  })

  test.afterAll(async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    if (orderId) {
      await supabase.from('orders').delete().eq('id', orderId)
    }
  })

  test('orderer files a complaint and sees the verdict; row updates afterward', async ({
    page,
  }) => {
    // 1. Visit /orders, find the row, click "Report a problem".
    await page.goto('/orders')
    const reportButton = page
      .getByTestId('orders-row-complaint-button')
      .first()
    await expect(reportButton).toBeVisible()
    await reportButton.click()

    // 2. Land on the complaint form (eligible state).
    await expect(page).toHaveURL(`/orders/${orderId}/complaints/new`)
    await expect(page.getByTestId('complaint-form')).toBeVisible()

    // 3. Fill + submit.
    await page.getByTestId('complaint-category').selectOption('missing_items')
    await page
      .getByTestId('complaint-reason')
      .fill('Two of the burritos in my cart screenshots were missing from the order I picked up.')
    await page.getByTestId('complaint-submit').click()

    // 4. Result state — mock adapter returns escalate.
    const result = page.getByTestId('complaint-result')
    await expect(result).toBeVisible()
    await expect(result).toHaveAttribute('data-verdict', 'escalate')

    // 5. /orders shows pill instead of button.
    await page.goto('/orders')
    await expect(page.getByTestId('orders-row-complaint-pill').first()).toBeVisible()
    await expect(page.getByTestId('orders-row-complaint-button')).toHaveCount(0)

    // 6. Re-visit complaint page → ineligible state.
    await page.goto(`/orders/${orderId}/complaints/new`)
    await expect(page.getByTestId('new-complaint-ineligible')).toBeVisible()
  })
})
