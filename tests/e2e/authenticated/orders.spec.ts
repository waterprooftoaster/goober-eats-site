/**
 * @file orders.spec.ts
 * @description Authenticated E2E tests for the orders listing page.
 *   Called by: Playwright "authenticated" project
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const TEST_EMAIL = 'orderer@goobereats.edu'
const ORDER_SUBTOTAL_CENTS = 2500
const ORDER_TOTAL_CENTS = 1000

let supabase: ReturnType<typeof createClient>
let userId: string
let orderId: string | null = null

test.describe('Authenticated orders', () => {
  test.beforeAll(async () => {
    supabase = createClient(
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

    // Ensure the orderer's profile has the same school as the order so RLS scoping holds
    await supabase
      .from('profiles')
      .update({ school_id: school.id })
      .eq('id', userId)

    // Seed an order via direct DB insert (orders are only created via webhook in production)
    const { data: order } = await supabase
      .from('orders')
      .insert({
        orderer_id: userId,
        school_id: school.id,
        restaurant_name: 'Chipotle',
        cart_screenshot_urls: [`pre-checkout/orders-e2e/${randomUUID()}.png`],
        subtotal_cents: ORDER_SUBTOTAL_CENTS,
        total_cents: ORDER_TOTAL_CENTS,
        status: 'open',
      })
      .select('id')
      .single()
    if (!order) throw new Error('Failed to create test order')
    orderId = order.id
  })

  test.afterAll(async () => {
    if (orderId) {
      await supabase.from('orders').delete().eq('id', orderId)
    }
  })

  test('list own orders', async ({ request }) => {
    const res = await request.get('/api/orders?role=orderer')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThanOrEqual(1)
  })
})
