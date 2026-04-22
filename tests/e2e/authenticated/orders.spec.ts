/**
 * @file orders.spec.ts
 * @description Authenticated E2E tests for the orders listing page.
 *   Called by: Playwright "authenticated" project
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const TEST_EMAIL = 'test@goobereats.test'

let supabase: ReturnType<typeof createClient>
let userId: string
let orderId: string | null = null

test.describe('Authenticated orders', () => {
  test.beforeAll(async () => {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    await supabase.rpc('seed_dev_eateries')

    const {
      data: { users },
    } = await supabase.auth.admin.listUsers()
    const user = users.find((u) => u.email === TEST_EMAIL)
    if (!user) throw new Error('Test user not found')
    userId = user.id

    // Seed an order via direct DB insert (orders are only created via webhook in production)
    const { data: eatery } = await supabase
      .from('eateries')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()
    if (!eatery) throw new Error('No eateries found')

    const { data: menuItem } = await supabase
      .from('menu_items')
      .select('id, name, original_price_cents')
      .eq('is_available', true)
      .limit(1)
      .single()
    if (!menuItem) throw new Error('No menu items found')

    const priceCents = Math.round(menuItem.original_price_cents * 0.5)
    const { data: order } = await supabase
      .from('orders')
      .insert({
        orderer_id: userId,
        eatery_id: eatery.id,
        items: [
          {
            menu_item_id: menuItem.id,
            name: menuItem.name,
            price_cents: priceCents,
            quantity: 1,
          },
        ],
        total_cents: priceCents,
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
