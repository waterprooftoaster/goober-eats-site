/**
 * @file swiper-mid-order-suspension.spec.ts
 * @description E2E: a swiper with in_progress orders gets a Stripe rejection
 *   account.updated webhook (rejected.fraud). Verifies that the orders flip
 *   back to 'open' with swiper_id=null, conversations.swiper_id is detached,
 *   a system message is posted, and stripe_accounts.suspended=true. Uses a
 *   synthesized webhook (no real Stripe account rejection needed).
 *   Called by: Playwright "authenticated" project
 */
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const TEST_EMAIL = 'test@goobereats.edu'
const VALID_PATH = 'pre-checkout/ABCdef1234/00000000-0000-4000-8000-000000000050.png'

let supabase: ReturnType<typeof createClient>
let stripe: InstanceType<typeof Stripe>
let userId: string
let schoolId: string
let orderId: string
let conversationId: string | null = null
let webhookSecret: string
const FAKE_STRIPE_ACCOUNT_ID = `acct_test_${Date.now()}`

test.describe('Mid-order swiper suspension auto-unaccepts', () => {
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

    await supabase.from('stripe_accounts').upsert(
      {
        user_id: userId,
        stripe_account_id: FAKE_STRIPE_ACCOUNT_ID,
        onboarding_complete: true,
        suspended: false,
      },
      { onConflict: 'user_id' }
    )

    // Seed an order in 'in_progress' assigned to this swiper.
    const { data: orderRow } = await supabase
      .from('orders')
      .insert({
        orderer_id: null,
        school_id: schoolId,
        restaurant_name: 'Chipotle',
        cart_screenshot_urls: [VALID_PATH],
        stripe_payment_intent_id: `pi_test_${Date.now()}`,
        subtotal_cents: 2500,
        total_cents: 1500,
        guest_name: 'Suspension Guest',
        guest_email: null,
        guest_access_token: crypto.randomUUID(),
        status: 'in_progress',
        swiper_id: userId,
      })
      .select('id')
      .single()
    if (!orderRow) throw new Error('Failed to seed order')
    orderId = orderRow.id as string

    const { data: convRow } = await supabase
      .from('conversations')
      .insert({
        order_id: orderId,
        orderer_id: null,
        swiper_id: userId,
        swiper_full_name: 'Test Swiper',
        swiper_assigned_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (convRow) conversationId = convRow.id as string
  })

  test.afterAll(async () => {
    if (orderId) {
      await supabase.from('messages').delete().eq('conversation_id', conversationId)
      await supabase.from('conversations').delete().eq('order_id', orderId)
      await supabase.from('orders').delete().eq('id', orderId)
    }
    await supabase.from('stripe_accounts').delete().eq('user_id', userId)
    // Restore is_swiper for subsequent tests.
    await supabase
      .from('profiles')
      .update({ is_swiper: true, school_id: schoolId })
      .eq('id', userId)
  })

  test('rejected.fraud webhook → orders unaccepted, conversations detached, system message posted, suspended=true', async ({
    request,
  }) => {
    const event = {
      id: `evt_suspend_${Date.now()}`,
      object: 'event',
      type: 'account.updated',
      data: {
        object: {
          id: FAKE_STRIPE_ACCOUNT_ID,
          details_submitted: true,
          charges_enabled: false,
          requirements: { disabled_reason: 'rejected.fraud' },
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

    // Order flipped back to 'open' with swiper_id=null
    const { data: order } = await supabase
      .from('orders')
      .select('status, swiper_id')
      .eq('id', orderId)
      .single()
    expect(order!.status).toBe('open')
    expect(order!.swiper_id).toBeNull()

    // Conversation detached
    if (conversationId) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('swiper_id, swiper_assigned_at')
        .eq('id', conversationId)
        .single()
      expect(conv!.swiper_id).toBeNull()
      expect(conv!.swiper_assigned_at).toBeNull()

      // System message posted
      const { data: messages } = await supabase
        .from('messages')
        .select('message_type, body, sender_id')
        .eq('conversation_id', conversationId)
        .eq('message_type', 'system')
      expect(messages).not.toBeNull()
      expect(messages!.length).toBeGreaterThanOrEqual(1)
      expect(messages![0].body).toContain('swiper became unavailable')
      expect(messages![0].sender_id).toBeNull()
    }

    // stripe_accounts.suspended flipped
    const { data: acct } = await supabase
      .from('stripe_accounts')
      .select('suspended')
      .eq('stripe_account_id', FAKE_STRIPE_ACCOUNT_ID)
      .single()
    expect(acct!.suspended).toBe(true)
  })
})
