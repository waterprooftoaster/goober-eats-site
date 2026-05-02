/**
 * @file order-cancel.spec.ts
 * @description E2E test for orderer cancel under manual capture: PI auth →
 *   webhook creates order → orderer cancels → order.status='cancelled' and
 *   the Stripe PI is canceled (auth hold released). Requires real Stripe
 *   test-mode keys.
 *   Called by: Playwright "authenticated" project
 */
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const TEST_EMAIL = 'test@goobereats.edu'
const VALID_PATH = 'pre-checkout/ABCdef1234/00000000-0000-4000-8000-000000000020.png'

let supabase: ReturnType<typeof createClient>
let stripe: InstanceType<typeof Stripe>
let userId: string
let schoolId: string
let orderId: string
let webhookSecret: string

test.describe('Orderer cancel releases the auth hold', () => {
  test.beforeAll(async () => {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .limit(1)
      .single()
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
      .update({ school_id: schoolId })
      .eq('id', userId)
  })

  test.afterAll(async () => {
    if (orderId) {
      await supabase.from('payments').delete().eq('order_id', orderId)
      await supabase.from('messages').delete().eq('conversation_id', orderId)
      await supabase.from('conversations').delete().eq('order_id', orderId)
      await supabase.from('orders').delete().eq('id', orderId)
    }
  })

  test('orderer cancel → PI canceled in Stripe + order.status=cancelled', async ({
    request,
  }) => {
    const subtotalCents = 2500
    const totalCents = 1500
    const expectedFeeCents = 250

    // ── Step 1: Authorize a real PI in requires_capture state ───────────
    const pi = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      capture_method: 'manual',
      payment_method: 'pm_card_visa',
      payment_method_types: ['card'],
      confirm: true,
      metadata: {
        school_id: schoolId,
        restaurant_name: 'Chipotle',
        cart_screenshot_paths: VALID_PATH,
        orderer_id: userId,
        subtotal_cents: String(subtotalCents),
        platform_fee_cents: String(expectedFeeCents),
        total_cents: String(totalCents),
      },
    })
    expect(pi.status).toBe('requires_capture')

    // ── Step 2: Webhook creates the order ──────────────────────────────
    const event = {
      id: `evt_cancel_${Date.now()}`,
      object: 'event',
      type: 'payment_intent.amount_capturable_updated',
      data: {
        object: {
          id: pi.id,
          amount: totalCents,
          amount_capturable: totalCents,
          metadata: pi.metadata,
        },
      },
    }
    const payload = JSON.stringify(event)
    const sigHeader = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    })
    const webhookRes = await request.post('/api/stripe/webhooks', {
      data: payload,
      headers: { 'Content-Type': 'application/json', 'stripe-signature': sigHeader },
    })
    expect(webhookRes.status()).toBe(200)

    const { data: orders } = await supabase
      .from('orders')
      .select('id, status')
      .eq('stripe_payment_intent_id', pi.id)
      .limit(1)
    expect(orders!.length).toBe(1)
    orderId = orders![0].id as string
    expect(orders![0].status).toBe('open')

    // ── Step 3: Orderer cancels via API ────────────────────────────────
    const cancelRes = await request.fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      data: { status: 'cancelled' },
    })
    expect(cancelRes.status()).toBe(200)

    // ── Step 4: Verify final state ─────────────────────────────────────
    const { data: finalOrder } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single()
    expect(finalOrder!.status).toBe('cancelled')

    const finalPi = await stripe.paymentIntents.retrieve(pi.id)
    expect(finalPi.status).toBe('canceled')
  })
})
