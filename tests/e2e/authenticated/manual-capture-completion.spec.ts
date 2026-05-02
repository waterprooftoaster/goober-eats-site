/**
 * @file manual-capture-completion.spec.ts
 * @description E2E test for the full manual-capture pipeline against real
 *   Stripe test mode: PI authorize → webhook creates order → swiper accepts
 *   → completes → captureAndTransfer captures and transfers to swiper's
 *   connected account. Replaces the pre-pivot checkout-pipeline.spec.ts.
 *   Requires real Stripe test-mode keys in env.
 *   Called by: Playwright "authenticated" project
 */
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const TEST_EMAIL = 'orderer@goobereats.edu'

const VALID_PATH = 'pre-checkout/ABCdef1234/00000000-0000-4000-8000-000000000010.png'

let supabase: ReturnType<typeof createClient>
let stripe: InstanceType<typeof Stripe>
let userId: string
let schoolId: string
let orderId: string
let webhookSecret: string
let stripeAccountId: string
let createdPaymentIntentId: string | null = null

test.describe('Manual capture completion pipeline', () => {
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
      .update({ is_swiper: true, school_id: schoolId })
      .eq('id', userId)

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

    if (stripeAccountId) {
      await stripe.accounts.del(stripeAccountId)
    }
    // Best-effort: refund the captured PI so test-mode platform balance is clean.
    if (createdPaymentIntentId) {
      try {
        await stripe.refunds.create({ payment_intent: createdPaymentIntentId })
      } catch {
        // PI may not have been captured (capture_failed branch); ignore.
      }
    }
  })

  test('full pipeline: PI auth → webhook creates order → swiper accepts → completes → captured + transferred', async ({
    request,
  }) => {
    // ── Step 1: Compute expected values ──────────────────────────────
    // Subtotal $25 → orderer pays $10 (40%), platform $2.50, swiper $7.50.
    const subtotalCents = 2500
    const totalCents = 1000
    const expectedFeeCents = 250
    const expectedTransferAmount = totalCents - expectedFeeCents

    // ── Step 1: Create a real PaymentIntent in requires_capture state ───
    const pi = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      capture_method: 'manual',
      payment_method: 'pm_card_visa',
      payment_method_types: ['card'],
      confirm: true,
      metadata: {
        is_guest: 'true',
        school_id: schoolId,
        restaurant_name: 'Chipotle',
        cart_screenshot_paths: VALID_PATH,
        guest_name: 'Pipeline Guest',
        subtotal_cents: String(subtotalCents),
        platform_fee_cents: String(expectedFeeCents),
        total_cents: String(totalCents),
      },
    })
    createdPaymentIntentId = pi.id
    expect(pi.status).toBe('requires_capture')

    // ── Step 2: Send signed amount_capturable_updated webhook ───────────
    const event = {
      id: `evt_pipeline_${Date.now()}`,
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
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': sigHeader,
      },
    })
    expect(webhookRes.status()).toBe(200)

    // ── Step 3: Verify order created with payments.status='pending' ─────
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('stripe_payment_intent_id', pi.id)
      .limit(1)

    expect(orders).not.toBeNull()
    expect(orders!.length).toBe(1)
    const order = orders![0]
    orderId = order.id as string

    expect(order.status).toBe('open')
    expect(order.orderer_id).toBeNull()
    expect(order.guest_name).toBe('Pipeline Guest')
    expect(order.total_cents).toBe(totalCents)
    expect(order.restaurant_name).toBe('Chipotle')

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .single()

    expect(payment).not.toBeNull()
    expect(payment!.stripe_payment_intent_id).toBe(pi.id)
    expect(payment!.status).toBe('pending')
    expect(payment!.platform_fee_cents).toBe(expectedFeeCents)
    expect(payment!.payee_id).toBeNull()

    // ── Step 4: Swiper accepts ─────────────────────────────────────────
    const acceptRes = await request.fetch(`/api/orders/${orderId}/accept`, {
      method: 'PATCH',
    })
    expect(acceptRes.status()).toBe(200)

    // ── Step 5: Swiper progresses → in_progress ────────────────────────
    const ipRes = await request.fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      data: { status: 'in_progress' },
    })
    expect(ipRes.status()).toBe(200)

    // Seed completion photo so the completion gate passes.
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

    // ── Step 6: Swiper completes → captureAndTransfer runs ─────────────
    const completeRes = await request.fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      data: { status: 'completed' },
    })
    expect(completeRes.status()).toBe(200)

    // ── Step 7: Verify final state: order completed, captured, transferred ──
    const { data: finalOrder } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single()

    expect(finalOrder).not.toBeNull()
    expect(finalOrder!.status).toBe('completed')

    const { data: finalPayment } = await supabase
      .from('payments')
      .select('status, platform_fee_cents, amount_cents, payee_id, capture_failed_at, transfer_failed_at')
      .eq('order_id', orderId)
      .single()

    expect(finalPayment).not.toBeNull()
    expect(finalPayment!.status).toBe('succeeded')
    expect(finalPayment!.platform_fee_cents).toBe(expectedFeeCents)
    expect(finalPayment!.amount_cents).toBe(totalCents)
    expect(finalPayment!.payee_id).toBe(userId)
    expect(finalPayment!.capture_failed_at).toBeNull()
    expect(finalPayment!.transfer_failed_at).toBeNull()

    // Verify against Stripe directly: the PI should have been captured and a
    // transfer of `expectedTransferAmount` should have landed on the connect account.
    const finalPi = await stripe.paymentIntents.retrieve(pi.id)
    expect(finalPi.status).toBe('succeeded')

    const transfers = await stripe.transfers.list({
      destination: stripeAccountId,
      limit: 5,
    })
    const ourTransfer = transfers.data.find(
      (t) => t.metadata?.order_id === orderId
    )
    expect(ourTransfer).toBeDefined()
    expect(ourTransfer!.amount).toBe(expectedTransferAmount)
  })
})
