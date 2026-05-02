/**
 * @file swiper-queue-realtime.spec.ts
 * @description E2E: a swiper viewing /swiper/orders sees a newly inserted
 *   open order appear in the live queue without reloading the page. Uses the
 *   service-role client to insert a synthetic open order at the swiper's
 *   school; relies on Supabase Realtime + useSwiperQueue to surface it.
 *   Cleans up the inserted row in afterEach (runs even on test failure).
 *   Called by: Playwright "authenticated-swiper" project
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SWIPER_EMAIL = 'swiper@goobereats.edu'

let testOrderId: string | null = null
let schoolId: string | null = null

test.describe('Swiper queue — realtime', () => {
  test.beforeAll(async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data: existing } = await supabase.auth.admin.listUsers()
    const swiper = existing?.users?.find((u) => u.email === SWIPER_EMAIL)
    if (!swiper) throw new Error('Swiper test user not found — swiper.setup must run first')

    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', swiper.id)
      .single()
    if (!profile?.school_id) throw new Error('Swiper profile missing school_id')
    schoolId = profile.school_id
  })

  test.afterEach(async () => {
    if (!testOrderId) return
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    await supabase.from('orders').delete().eq('id', testOrderId)
    testOrderId = null
  })

  test('a newly inserted open order appears in the queue without reload', async ({ page }) => {
    await page.goto('/swiper/orders')
    await expect(page.getByTestId('swiper-orders-page')).toBeVisible()

    // Snapshot current queue card count so we can detect the new row.
    const initialCardCount = await page.getByTestId('order-card').count()

    // Give the Realtime WebSocket a moment to attach the school-scoped
    // subscription before we insert. Without this, the INSERT can land
    // before the channel is subscribed and the event is missed.
    await page.waitForTimeout(2000)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    // Service-role insert mimics what the Stripe payment_intent.succeeded
    // webhook does, minus the Stripe ids. RLS is bypassed by the service key.
    const restaurantName = `RT Smoke ${Date.now()}`
    const { data: inserted, error } = await supabase
      .from('orders')
      .insert({
        school_id: schoolId,
        restaurant_name: restaurantName,
        cart_screenshot_urls: ['ghost-path/screenshot.jpg'],
        subtotal_cents: 1500,
        total_cents: 1650,
        guest_name: 'RT Smoke Guest',
        status: 'open',
      })
      .select('id')
      .single()
    if (error || !inserted) throw new Error(`Failed to seed test order: ${error?.message}`)
    testOrderId = inserted.id

    // The realtime path: useSwiperQueue subscribes to school-scoped INSERTs,
    // refetches /api/swiper/pending on event, and replaces local state. The
    // new order's restaurant name must appear within a few seconds.
    await expect(page.getByText(restaurantName, { exact: false })).toBeVisible({
      timeout: 30000,
    })
    expect(await page.getByTestId('order-card').count()).toBeGreaterThan(initialCardCount)
  })
})
