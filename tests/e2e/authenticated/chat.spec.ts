/**
 * @file chat.spec.ts
 * @description Authenticated E2E tests for in-order chat between orderer and swiper.
 *   Called by: Playwright "authenticated" project
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const TEST_EMAIL = 'test@goobereats.test'
const ORDER_SUBTOTAL_CENTS = 2500
const ORDER_TOTAL_CENTS = 1500
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

    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .limit(1)
      .single()
    if (!school) throw new Error('No schools found')

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
        orderer_id: null,
        swiper_id: null,
        school_id: school.id,
        restaurant_name: 'Chipotle',
        cart_screenshot_urls: [`pre-checkout/chat-e2e/${randomUUID()}.png`],
        subtotal_cents: ORDER_SUBTOTAL_CENTS,
        total_cents: ORDER_TOTAL_CENTS,
        status: 'open',
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

  test('accept → conversation created (no DB system message; pseudo-message is client-side)', async ({ request }) => {
    const acceptRes = await request.fetch(`/api/orders/${orderId}/accept`, { method: 'PATCH' })
    expect(acceptRes.status()).toBe(200)
    const acceptBody = await acceptRes.json()
    expect(acceptBody.status).toBe('in_progress')

    // Conversation is created server-side; messages start empty because the
    // "in_progress" notification is rendered as a client-side pseudo-message
    // (chat-thread.tsx derives it from order.status), not a DB row.
    const msgRes = await request.get(`/api/messages/${orderId}`)
    expect(msgRes.status()).toBe(200)
    const msgBody = await msgRes.json()
    expect(msgBody.conversation).toBeTruthy()
    expect(Array.isArray(msgBody.messages)).toBe(true)
    expect(msgBody.messages).toHaveLength(0)
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

  test('cannot complete without completion photo', async ({ request }) => {
    const res = await request.fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      data: { status: 'completed' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/completion photo/i)
  })

  test('upload completion photo → photo message appears', async ({ request }) => {
    const uploadRes = await request.fetch(`/api/messages/${orderId}/upload`, {
      method: 'POST',
      multipart: {
        file: {
          name: 'completion.jpg',
          mimeType: 'image/jpeg',
          buffer: TINY_JPEG,
        },
      },
    })
    expect(uploadRes.status()).toBe(201)
    const uploadBody = await uploadRes.json()
    expect(uploadBody.message_type).toBe('completion_photo')
    expect(uploadBody.image_url).toBeTruthy()

    const msgRes = await request.get(`/api/messages/${orderId}`)
    const msgBody = await msgRes.json()
    const photoMessages = msgBody.messages.filter(
      (m: { message_type: string }) => m.message_type === 'completion_photo'
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

})
