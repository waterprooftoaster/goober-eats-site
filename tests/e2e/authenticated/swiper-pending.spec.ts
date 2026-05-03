/**
 * @file swiper-pending.spec.ts
 * @description Authenticated E2E tests for the swiper's pending orders view.
 *   Called by: Playwright "authenticated" project
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const TEST_EMAIL = 'orderer@goobereats.edu'

test.describe('Pending Orders', () => {
  test.beforeAll(async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data: schools } = await supabase
      .from('schools')
      .select('id')
      .limit(1)
      .single()
    if (!schools) throw new Error('No schools found')

    const { data: existing } = await supabase.auth.admin.listUsers()
    const user = existing?.users?.find((u) => u.email === TEST_EMAIL)
    if (!user) throw new Error('Test user not found')

    await supabase
      .from('profiles')
      .update({ is_swiper: true, school_id: schools.id })
      .eq('id', user.id)
    // S07: layout.tsx now resolves swiper status via the §10 Principal helper,
    // which requires a stripe_accounts row with onboarding_complete=true to
    // classify the user as authed_swiper (and therefore render the swiper
    // queue affordances). Seed it here so the test fixture matches the new
    // contract.
    await supabase
      .from('stripe_accounts')
      .upsert(
        { user_id: user.id, stripe_account_id: 'acct_swiper_pending_e2e', onboarding_complete: true },
        { onConflict: 'user_id' }
      )
  })

  test.afterAll(async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data: existing } = await supabase.auth.admin.listUsers()
    const user = existing?.users?.find((u) => u.email === TEST_EMAIL)
    if (user) {
      await supabase.from('stripe_accounts').delete().eq('user_id', user.id)
      await supabase
        .from('profiles')
        .update({ is_swiper: false })
        .eq('id', user.id)
    }
  })

  test('GET /api/swiper/pending returns 200 with array', async ({ request }) => {
    const res = await request.get('/api/swiper/pending')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('page loads and shows Open Orders heading', async ({ page }) => {
    await page.goto('/swiper/orders')
    await expect(page.getByTestId('swiper-orders-page')).toBeVisible()
  })

  test('sidebar shows Pending Orders link', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('swiper-orders-button')).toBeVisible()
  })
})
