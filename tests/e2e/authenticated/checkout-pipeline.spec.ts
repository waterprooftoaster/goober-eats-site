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

const TEST_EMAIL = 'test@goobereats.test'

let supabase: ReturnType<typeof createClient>
let stripe: InstanceType<typeof Stripe>
let userId: string
let schoolId: string
let eateryId: string
let menuItemId: string
let menuItemOriginalCents: number
let cartId: string
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

    await supabase.rpc('seed_dev_eateries')

    // Get school
    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .limit(1)
      .single()
    if (!school) throw new Error('No schools found')
    schoolId = school.id

    // Get eatery + menu item
    const { data: menuItem } = await supabase
      .from('menu_items')
      .select('id, name, original_price_cents, eatery_id')
      .eq('is_available', true)
      .limit(1)
      .single()
    if (!menuItem) throw new Error('No menu items found')
    menuItemId = menuItem.id
    menuItemOriginalCents = menuItem.original_price_cents

    const { data: eatery } = await supabase
      .from('eateries')
      .select('id')
      .eq('id', menuItem.eatery_id)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .single()
    if (!eatery) throw new Error('No eateries found for school')
    eateryId = eatery.id

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

    // Create a guest cart with one item
    const { data: cart } = await supabase
      .from('carts')
      .insert({ session_id: crypto.randomUUID(), eatery_id: eateryId })
      .select('id')
      .single()
    if (!cart) throw new Error('Failed to create test cart')
    cartId = cart.id

    await supabase.from('cart_items').insert({
      cart_id: cartId,
      menu_item_id: menuItemId,
      quantity: 2,
      selected_options: [],
    })
  })

  test.afterAll(async () => {
    if (orderId) {
      await supabase.from('payments').delete().eq('order_id', orderId)
      await supabase.from('messages').delete().eq('conversation_id', orderId)
      await supabase.from('conversations').delete().eq('order_id', orderId)
      await supabase.from('orders').delete().eq('id', orderId)
    }
    // Clean up cart if webhook didn't delete it
    if (cartId) {
      await supabase.from('cart_items').delete().eq('cart_id', cartId)
      await supabase.from('carts').delete().eq('id', cartId)
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

    const userPriceCents = Math.round(menuItemOriginalCents * 0.5)
    const totalItemCents = userPriceCents * 2 // quantity=2
    const tipCents = 100
    const totalCents = totalItemCents + tipCents
    const expectedFeeCents = Math.round(totalItemCents * 0.2) // 10% of original = 20% of user price

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
            cart_id: cartId,
            eatery_id: eateryId,
            guest_name: 'Pipeline Guest',
            tip_cents: String(tipCents),
            special_instructions: 'Extra ketchup',
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
      .eq('eatery_id', eateryId)
      .order('created_at', { ascending: false })
      .limit(1)

    expect(orders).not.toBeNull()
    expect(orders!.length).toBe(1)
    const order = orders![0]
    orderId = order.id

    expect(order.status).toBe('pending')
    expect(order.orderer_id).toBeNull()
    expect(order.guest_name).toBe('Pipeline Guest')
    expect(order.stripe_payment_intent_id).toBe(piId)
    expect(order.tip_cents).toBe(tipCents)
    expect(order.special_instructions).toBe('Extra ketchup')
    expect(order.total_cents).toBe(totalCents)

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

    // Verify cart was cleaned up
    const { data: cartAfter } = await supabase
      .from('carts')
      .select('id')
      .eq('id', cartId)
      .maybeSingle()
    expect(cartAfter).toBeNull()

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

    // Seed delivery photo for completion requirement
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('order_id', orderId)
      .single()
    expect(conv).not.toBeNull()

    await supabase.from('messages').insert({
      conversation_id: conv!.id,
      sender_id: userId,
      message_type: 'delivery_photo',
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
      .select('status, total_cents, tip_cents')
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
    expect(finalPayment!.platform_fee_cents).toBe(Math.round(totalItemCents * 0.2))
    expect(finalPayment!.payee_id).toBe(userId)
  })
})
