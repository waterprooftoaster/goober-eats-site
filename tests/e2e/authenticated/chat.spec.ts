import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const TEST_EMAIL = 'test@goobereats.test'
const FAKE_UUID = '00000000-0000-4000-8000-000000000099'

// 1×1 white JPEG (107 bytes)
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U' +
  'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA' +
  'Af/bAAQAAf/EABMAAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oA' +
  'CAQBAAA/ACoA/9k=',
  'base64'
)

let userId: string
let orderId: string

test.describe('Chat Flow', () => {
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
        { user_id: userId, stripe_account_id: 'acct_chat_test', onboarding_complete: true },
        { onConflict: 'user_id' }
      )

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
        guest_name: 'Chat Test',
      })
      .select('id')
      .single()
    if (!order) throw new Error('Failed to create test order')
    orderId = order.id
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

  test('accept → conversation created → system message appears', async ({ request }) => {
    const acceptRes = await request.fetch(`/api/orders/${orderId}/accept`, { method: 'PATCH' })
    expect(acceptRes.status()).toBe(200)
    const acceptBody = await acceptRes.json()
    expect(acceptBody.status).toBe('in_progress')

    const msgRes = await request.get(`/api/messages/${orderId}`)
    expect(msgRes.status()).toBe(200)
    const msgBody = await msgRes.json()
    expect(Array.isArray(msgBody.messages)).toBe(true)
    expect(msgBody.messages.length).toBeGreaterThan(0)
    expect(msgBody.messages[0].message_type).toBe('system')
  })

  test('send text message', async ({ request }) => {
    const sendRes = await request.post('/api/messages', {
      data: { order_id: orderId, body: 'Hello from swiper', message_type: 'text' },
    })
    expect(sendRes.status()).toBe(201)

    const msgRes = await request.get(`/api/messages/${orderId}`)
    const msgBody = await msgRes.json()
    const textMessages = msgBody.messages.filter(
      (m: { message_type: string }) => m.message_type === 'text'
    )
    expect(textMessages.length).toBeGreaterThan(0)
    expect(textMessages[0].body).toBe('Hello from swiper')
  })

  test('cannot complete without delivery photo', async ({ request }) => {
    const res = await request.fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      data: { status: 'completed' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/delivery photo/i)
  })

  test('upload delivery photo → photo message appears', async ({ request }) => {
    const formData = new FormData()
    formData.append('file', new Blob([TINY_JPEG], { type: 'image/jpeg' }), 'delivery.jpg')

    const uploadRes = await request.fetch(`/api/messages/${orderId}/upload`, {
      method: 'POST',
      multipart: {
        file: {
          name: 'delivery.jpg',
          mimeType: 'image/jpeg',
          buffer: TINY_JPEG,
        },
      },
    })
    expect(uploadRes.status()).toBe(201)
    const uploadBody = await uploadRes.json()
    expect(uploadBody.message_type).toBe('delivery_photo')
    expect(uploadBody.image_url).toBeTruthy()

    const msgRes = await request.get(`/api/messages/${orderId}`)
    const msgBody = await msgRes.json()
    const photoMessages = msgBody.messages.filter(
      (m: { message_type: string }) => m.message_type === 'delivery_photo'
    )
    expect(photoMessages.length).toBeGreaterThan(0)
  })

  test('complete after photo → succeeds', async ({ request }) => {
    const res = await request.fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      data: { status: 'completed' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('completed')
  })

  test('chat input disabled after completion', async ({ page }) => {
    await page.goto(`/order/${orderId}/chat`)
    await expect(page.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  test('non-participant redirected to home', async ({ page }) => {
    await page.goto(`/order/${FAKE_UUID}/chat`)
    await expect(page).toHaveURL('/')
  })
})
