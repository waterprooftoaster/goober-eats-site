/**
 * @file checkout-pipeline.spec.ts
 * @description E2E test for the full checkout pipeline: guest order → swiper accepts → completes → paid.
 *   Simulates payment_intent.succeeded via signed webhook payload to match production flow.
 *   Requires real Stripe test-mode keys in env.
 *   Called by: Playwright "authenticated" project
 */
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const TEST_EMAIL = 'test@goobereats.edu'

let supabase: ReturnType<typeof createClient>
let stripe: InstanceType<typeof Stripe>
let userId: string
let schoolId: string
let orderId: string
let webhookSecret: string
let stripeAccountId: string

test.describe('Checkout Pipeline', () => {
  test.beforeAll(async () => {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

    // Get school
    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .limit(1)
      .single()
    if (!school) throw new Error('No schools found')
    schoolId = school.id

    // Set up test user as swiper
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

    // Create a real Stripe test-mode connected account for transfer
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      capabilities: { transfers: { requested: true } },
    })
    stripeAccountId = account.id

    await supabase.from('stripe_accounts').upsert(
      {
        user_id: userId,
        stripe_account_id: stripeAccountId,
        onboarding_complete: true,
      },
      { onConflict: 'user_id' }
    )
  })

  test.afterAll(async () => {
    if (orderId) {
      await supabase.from('payments').delete().eq('order_id', orderId)
      await supabase.from('messages').delete().eq('conversation_id', orderId)
      await supabase.from('conversations').delete().eq('order_id', orderId)
      await supabase.from('orders').delete().eq('id', orderId)
    }
    await supabase.from('stripe_accounts').delete().eq('user_id', userId)
    await supabase
      .from('profiles')
      .update({ is_swiper: false })
      .eq('id', userId)

    // Clean up the Stripe test-mode connected account
    if (stripeAccountId) {
      await stripe.accounts.del(stripeAccountId)
    }
  })

  test('full pipeline: guest checkout → webhook creates order → swiper accepts → completes → paid', async ({
    request,
  }) => {
    // ── Step 1: Compute expected values ──────────────────────────────
    // Subtotal $25 → orderer pays $15 (60%), platform $2.50, swiper $12.50.
    const subtotalCents = 2500
    const totalCents = 1500
    const expectedFeeCents = 250

    // ── Step 2: Simulate payment_intent.succeeded webhook ──────────────
    const piId = `pi_pipeline_${Date.now()}`
    const event = {
      id: `evt_pipeline_${Date.now()}`,
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: piId,
          amount: totalCents,
          metadata: {
            is_guest: 'true',
            restaurant_name: 'Chipotle',
            cart_screenshot_urls: JSON.stringify(['https://example.com/test-cart.png']),
            school_id: schoolId,
            guest_name: 'Pipeline Guest',
            subtotal_cents: String(subtotalCents),
            platform_fee_cents: String(expectedFeeCents),
            total_cents: String(totalCents),
          },
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
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': sigHeader,
      },
    })
    expect(webhookRes.status()).toBe(200)

    // ── Step 3: Verify order was created ───────────────────────────────
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('guest_name', 'Pipeline Guest')
      .order('created_at', { ascending: false })
      .limit(1)

    expect(orders).not.toBeNull()
    expect(orders!.length).toBe(1)
    const order = orders![0]
    orderId = order.id

    expect(order.status).toBe('open')
    expect(order.orderer_id).toBeNull()
    expect(order.guest_name).toBe('Pipeline Guest')
    expect(order.stripe_payment_intent_id).toBe(piId)
    expect(order.total_cents).toBe(totalCents)
    expect(order.restaurant_name).toBe('Chipotle')
    expect(order.cart_screenshot_urls).toContain('https://example.com/test-cart.png')

    // Verify payment record exists
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .single()

    expect(payment).not.toBeNull()
    expect(payment!.stripe_payment_intent_id).toBe(piId)
    expect(payment!.status).toBe('succeeded')
    expect(payment!.platform_fee_cents).toBe(expectedFeeCents)
    expect(payment!.payer_id).toBeNull()
    expect(payment!.payee_id).toBeNull() // no swiper yet

    // ── Step 4: Swiper accepts order ───────────────────────────────────
    const acceptRes = await request.fetch(`/api/orders/${orderId}/accept`, {
      method: 'PATCH',
    })
    expect(acceptRes.status()).toBe(200)
    const acceptBody = await acceptRes.json()
    expect(acceptBody.status).toBe('accepted')
    expect(acceptBody.swiper_id).toBe(userId)

    // ── Step 5: Swiper progresses → in_progress ────────────────────────
    const ipRes = await request.fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      data: { status: 'in_progress' },
    })
    expect(ipRes.status()).toBe(200)

    // Seed completion photo for the completion requirement
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('order_id', orderId)
      .single()
    expect(conv).not.toBeNull()

    await supabase.from('messages').insert({
      conversation_id: conv!.id,
      sender_id: userId,
      message_type: 'completion_photo',
      image_url: 'https://example.com/pipeline-photo.jpg',
      body: null,
    })

    // ── Step 6: Swiper completes → triggers transfer → order goes to paid ──
    const completeRes = await request.fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      data: { status: 'completed' },
    })
    expect(completeRes.status()).toBe(200)

    // ── Step 7: Verify final state — order must be 'paid' ─────────────
    const { data: finalOrder } = await supabase
      .from('orders')
      .select('status, total_cents')
      .eq('id', orderId)
      .single()

    expect(finalOrder).not.toBeNull()
    expect(finalOrder!.status).toBe('paid')

    // Verify payment: fee math + payee_id is swiper
    const { data: finalPayment } = await supabase
      .from('payments')
      .select('platform_fee_cents, amount_cents, payee_id')
      .eq('order_id', orderId)
      .single()

    expect(finalPayment).not.toBeNull()
    expect(finalPayment!.platform_fee_cents).toBe(expectedFeeCents)
    expect(finalPayment!.payee_id).toBe(userId)
  })
})
