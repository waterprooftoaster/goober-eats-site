/**
 * @file completion-banner.spec.ts
 * @description Authenticated E2E tests for the order completion banner shown to swipers.
 *   Called by: Playwright "authenticated" project
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const TEST_EMAIL = 'test@goobereats.test'
const GUEST_TOKEN = '00000000-0000-4000-8000-000000000042'

let userId: string
let orderId: string

test.describe('CompletionBanner', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ request }) => {
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
      .select('id, name, original_price_cents, eatery_id')
      .eq('is_available', true)
      .limit(1)
      .single()
    if (!menuItem) throw new Error('No menu items found')

    const { data: eatery } = await supabase
      .from('eateries')
      .select('id')
      .eq('id', menuItem.eatery_id)
      .eq('school_id', school.id)
      .eq('is_active', true)
      .single()
    if (!eatery) throw new Error('No eatery found for school with menu items')

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
        { user_id: userId, stripe_account_id: 'acct_banner_test', onboarding_complete: true },
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
        guest_name: 'Banner Test',
        guest_access_token: GUEST_TOKEN,
      })
      .select('id')
      .single()
    if (!order) throw new Error('Failed to create test order')
    orderId = order.id

    // Accept the order so it is in_progress with a conversation
    const acceptRes = await request.fetch(`/api/orders/${orderId}/accept`, { method: 'PATCH' })
    if (!acceptRes.ok()) throw new Error('Failed to accept test order')
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

  test('swiper sees CompletionBanner when order is in_progress (regression)', async ({ page }) => {
    await page.goto(`/order/${orderId}/chat`)
    await expect(page.getByRole('button', { name: 'Complete Order' })).toBeVisible()
  })

  test('Complete Order and Unaccept buttons are both visible side-by-side', async ({ page }) => {
    await page.goto(`/order/${orderId}/chat`)
    const completeBtn = page.getByRole('button', { name: 'Complete Order' })
    const unacceptBtn = page.getByRole('button', { name: 'Unaccept' })
    await expect(completeBtn).toBeVisible()
    await expect(unacceptBtn).toBeVisible()
  })

  test('orderer (guest) viewing the same chat does not see the banner', async ({ page, context }) => {
    // Grant the guest token cookie so the guest page accepts us
    await context.addCookies([
      {
        name: `guest_order_token_${orderId}`,
        value: GUEST_TOKEN,
        domain: 'localhost',
        path: '/',
      },
    ])

    // The guest page opens the chat panel as a guest (currentUserId=null) and redirects to /
    await page.goto(`/order/guest/${orderId}`)

    // Wait for the chat panel to appear (panel header contains the short order ID)
    const shortId = orderId.slice(0, 8)
    await expect(page.getByText(`Order #${shortId}`)).toBeVisible({ timeout: 10000 })

    // Buttons must NOT be visible — guests have currentUserId=null so condition fails
    await expect(page.getByRole('button', { name: 'Complete Order' })).not.toBeVisible()
  })

  test('clicking Unaccept resets order to open and banner disappears', async ({ page, request }) => {
    // Ensure order is in_progress regardless of prior test state
    // (guest test does not modify the order, but this guards against re-runs)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data: current } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single()
    if (current?.status !== 'in_progress') {
      await request.fetch(`/api/orders/${orderId}/accept`, { method: 'PATCH' })
    }

    await page.goto(`/order/${orderId}/chat`)
    await expect(page.getByRole('button', { name: 'Complete Order' })).toBeVisible()

    await page.getByRole('button', { name: 'Unaccept' }).click()

    // Buttons disappear (component returns null after done=true)
    await expect(page.getByRole('button', { name: 'Complete Order' })).not.toBeVisible()

    // Verify order is back to open via Supabase directly
    const { data: order } = await supabase
      .from('orders')
      .select('status, swiper_id')
      .eq('id', orderId)
      .single()
    expect(order?.status).toBe('open')
    expect(order?.swiper_id).toBeNull()
  })
})
