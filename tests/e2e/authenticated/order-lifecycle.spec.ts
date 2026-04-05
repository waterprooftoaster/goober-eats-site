import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const TEST_EMAIL = 'test@goobereats.test'
const FAKE_UUID = '00000000-0000-4000-8000-000000000099'

let userId: string
let orderId: string
let conversationId: string

test.describe('Order Lifecycle', () => {
  test.beforeAll(async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    await supabase.rpc('seed_dev_eateries')

    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .limit(1)
      .single()
    if (!school) throw new Error('No schools found')

    // Find an eatery that has at least one available menu item
    const { data: menuItem } = await supabase
      .from('menu_items')
      .select('id, name, original_price_cents, restaurant_id')
      .eq('is_available', true)
      .limit(1)
      .single()
    if (!menuItem) throw new Error('No menu items found')

    const { data: eatery } = await supabase
      .from('eateries')
      .select('id')
      .eq('id', menuItem.restaurant_id)
      .eq('school_id', school.id)
      .eq('is_active', true)
      .single()
    if (!eatery) throw new Error('No eateries found for school with menu items')

    const { data: { users } } = await supabase.auth.admin.listUsers()
    const user = users.find((u) => u.email === TEST_EMAIL)
    if (!user) throw new Error('Test user not found')
    userId = user.id

    await supabase
      .from('profiles')
      .update({ is_swiper: true, school_id: school.id })
      .eq('id', userId)

    await supabase
      .from('stripe_accounts')
      .upsert(
        { user_id: userId, stripe_account_id: 'acct_lifecycle_test', onboarding_complete: true },
        { onConflict: 'user_id' }
      )

    // Insert test order directly as a guest order (satisfies orders_orderer_or_guest constraint)
    const { data: order } = await supabase
      .from('orders')
      .insert({
        eatery_id: eatery.id,
        orderer_id: null,
        swiper_id: null,
        status: 'open',
        items: [
          {
            menu_item_id: menuItem.id,
            name: menuItem.name,
            price_cents: menuItem.original_price_cents,
            quantity: 1,
          },
        ],
        total_cents: menuItem.original_price_cents,
        tip_cents: 0,
        guest_name: 'Lifecycle Test',
      })
      .select('id')
      .single()
    if (!order) throw new Error('Failed to create test order')
    orderId = order.id

    // Seed a payment row so the completion guard (service-client payment check) passes.
    // In production the webhook creates this; tests bypass the webhook.
    await supabase.from('payments').insert({
      order_id: orderId,
      stripe_payment_intent_id: 'pi_lifecycle_test',
      amount_cents: menuItem.original_price_cents,
      platform_fee_cents: Math.floor(menuItem.original_price_cents * 0.1),
      status: 'succeeded',
      payer_id: null,
      payee_id: null,
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
    await supabase.from('stripe_accounts').delete().eq('user_id', userId)
    await supabase
      .from('profiles')
      .update({ is_swiper: false })
      .eq('id', userId)
  })

  test('full order lifecycle: open → accept → completed', async ({ request }) => {
    // Open order appears in queue
    const pendingRes = await request.get('/api/swiper/pending')
    expect(pendingRes.status()).toBe(200)
    const pendingBody = await pendingRes.json()
    expect(Array.isArray(pendingBody)).toBe(true)
    expect(pendingBody.some((o: { id: string }) => o.id === orderId)).toBe(true)

    // Accept → immediately in_progress
    const acceptRes = await request.fetch(`/api/orders/${orderId}/accept`, { method: 'PATCH' })
    expect(acceptRes.status()).toBe(200)
    const acceptBody = await acceptRes.json()
    expect(acceptBody.status).toBe('in_progress')

    // Accept again → 409 race condition
    const dupRes = await request.fetch(`/api/orders/${orderId}/accept`, { method: 'PATCH' })
    expect(dupRes.status()).toBe(409)

    // Fetch conversation and seed a delivery photo so completion can proceed
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('order_id', orderId)
      .single()
    if (!conv) throw new Error('Conversation not created after accept')
    conversationId = conv.id

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: userId,
      message_type: 'delivery_photo',
      image_url: 'https://example.com/test.jpg',
      body: null,
    })

    // Invalid transition: in_progress → cancelled (only orderer can cancel, and only from open)
    const invalidRes = await request.fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      data: { status: 'cancelled' },
    })
    expect(invalidRes.status()).toBe(400)

    // Advance to completed
    const completeRes = await request.fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      data: { status: 'completed' },
    })
    expect(completeRes.status()).toBe(200)
    const completeBody = await completeRes.json()
    expect(completeBody.status).toBe('completed')
  })

  test('swiper un-accept: in_progress → open → re-accept → completed', async ({ request }) => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    const { data: menuItem } = await supabase
      .from('menu_items')
      .select('id, name, original_price_cents, restaurant_id')
      .eq('is_available', true)
      .limit(1)
      .single()
    if (!menuItem) throw new Error('No menu items found')

    const { data: unacceptOrder } = await supabase
      .from('orders')
      .insert({
        eatery_id: menuItem.restaurant_id,
        orderer_id: null,
        swiper_id: null,
        status: 'open',
        items: [{ menu_item_id: menuItem.id, name: menuItem.name, price_cents: menuItem.original_price_cents, quantity: 1 }],
        total_cents: menuItem.original_price_cents,
        tip_cents: 0,
        guest_name: 'Un-accept Test',
        guest_phone: '+15005550006',
      })
      .select('id')
      .single()
    if (!unacceptOrder) throw new Error('Failed to create order')

    await supabase.from('payments').insert({
      order_id: unacceptOrder.id,
      stripe_payment_intent_id: 'pi_unaccept_test',
      amount_cents: menuItem.original_price_cents,
      platform_fee_cents: Math.floor(menuItem.original_price_cents * 0.1),
      status: 'succeeded',
      payer_id: null,
      payee_id: null,
    })

    try {
      // Accept → in_progress
      const acceptRes = await request.fetch(`/api/orders/${unacceptOrder.id}/accept`, { method: 'PATCH' })
      expect(acceptRes.status()).toBe(200)
      expect((await acceptRes.json()).status).toBe('in_progress')

      // Un-accept → open
      const unacceptRes = await request.fetch(`/api/orders/${unacceptOrder.id}/status`, {
        method: 'PATCH',
        data: { status: 'open' },
      })
      expect(unacceptRes.status()).toBe(200)
      expect((await unacceptRes.json()).status).toBe('open')

      // Re-accept → in_progress again
      const reacceptRes = await request.fetch(`/api/orders/${unacceptOrder.id}/accept`, { method: 'PATCH' })
      expect(reacceptRes.status()).toBe(200)
      expect((await reacceptRes.json()).status).toBe('in_progress')

      // Seed delivery photo and complete
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('order_id', unacceptOrder.id)
        .single()
      if (!conv) throw new Error('Conversation not created')

      await supabase.from('messages').insert({
        conversation_id: conv.id,
        sender_id: userId,
        message_type: 'delivery_photo',
        image_url: 'https://example.com/test.jpg',
        body: null,
      })

      const completeRes = await request.fetch(`/api/orders/${unacceptOrder.id}/status`, {
        method: 'PATCH',
        data: { status: 'completed' },
      })
      expect(completeRes.status()).toBe(200)
      expect((await completeRes.json()).status).toBe('completed')
    } finally {
      await supabase.from('orders').delete().eq('id', unacceptOrder.id)
    }
  })

  test('POST /api/orders/{id}/pay by swiper (not orderer) returns 403', async ({ request }) => {
    const res = await request.post(`/api/orders/${orderId}/pay`)
    expect(res.status()).toBe(403)
  })

  test('PATCH /api/orders/{unknown-id}/status returns 404', async ({ request }) => {
    const res = await request.fetch(`/api/orders/${FAKE_UUID}/status`, {
      method: 'PATCH',
      data: { status: 'completed' },
    })
    expect(res.status()).toBe(404)
  })
})
