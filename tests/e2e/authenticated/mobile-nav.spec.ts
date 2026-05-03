/**
 * @file mobile-nav.spec.ts
 * @description Authenticated E2E tests for mobile navigation UI.
 *   Called by: Playwright "authenticated" project
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const TEST_EMAIL = 'orderer@goobereats.edu'
const MOBILE_VIEWPORT = { width: 375, height: 812 }

test.describe('Mobile navigation', () => {
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

    const { data: existing } = await supabase.auth.admin.listUsers()
    const user = existing?.users?.find((u) => u.email === TEST_EMAIL)
    if (!user) throw new Error('Test user not found')

    await supabase
      .from('profiles')
      .update({ is_swiper: true, school_id: school.id })
      .eq('id', user.id)
    // S07: layout.tsx now uses Principal-driven swiper detection (requires a
    // stripe_accounts row with onboarding_complete=true). Seed for the fixture.
    await supabase
      .from('stripe_accounts')
      .upsert(
        { user_id: user.id, stripe_account_id: 'acct_mobile_nav_e2e', onboarding_complete: true },
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

  test('sidebar hidden at mobile viewport', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')
    await expect(page.locator('aside')).toBeHidden()
  })

  test('swiper dashboard icon visible and navigates', async ({ page }) => {
    // Pre-existing broken: route `/swiper/dashboard` does not exist in current app.
    // Left unmigrated; flagged in SESSION_LOG. Migration will happen when the
    // Swiper Dashboard page is introduced (Session 07 shell rewrite at earliest).
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')
    const link = page.getByRole('link', { name: 'Swiper Dashboard' })
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL('/swiper/dashboard')
  })

  test('pending orders icon visible and navigates', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')
    const link = page.getByTestId('swiper-orders-button')
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL('/swiper/orders')
  })

  test('profile icon visible at mobile viewport', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')
    await expect(page.getByTestId('header-account-link')).toBeVisible()
  })
})
