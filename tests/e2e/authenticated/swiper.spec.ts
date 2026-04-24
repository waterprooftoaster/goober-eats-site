/**
 * @file swiper.spec.ts
 * @description Authenticated E2E tests for the swiper order acceptance and completion flow.
 *   Called by: Playwright "authenticated" project
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const TEST_EMAIL = 'test@goobereats.test'

test.describe('PATCH /api/profile — authenticated', () => {
  let schoolId: string

  test.beforeAll(async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    // Ensure seed eateries exist (creates the NYU school if not present)
    await supabase.rpc('seed_dev_eateries')
    const { data: schools } = await supabase
      .from('schools')
      .select('id')
      .limit(1)
      .single()
    if (!schools) throw new Error('No schools found — run seed first')
    schoolId = schools.id

    // Reset test user's profile to clean state
    const { data: existing } = await supabase.auth.admin.listUsers()
    const user = existing?.users?.find((u) => u.email === TEST_EMAIL)
    if (user) {
      await supabase
        .from('profiles')
        .update({ school_id: null, is_swiper: false })
        .eq('id', user.id)
      // Remove any stripe account for the test user so tests are predictable
      await supabase.from('stripe_accounts').delete().eq('user_id', user.id)
    }
  })

  test('updates school_id successfully', async ({ request }) => {
    const res = await request.patch('/api/profile', {
      data: { school_id: schoolId },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.school_id).toBe(schoolId)
    expect(body.is_swiper).toBe(false)
  })

  test('returns 422 when activating swiper with no school_id', async ({ request }) => {
    // Reset school_id first
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data: existing } = await supabase.auth.admin.listUsers()
    const user = existing?.users?.find((u) => u.email === TEST_EMAIL)
    if (user) {
      await supabase.from('profiles').update({ school_id: null }).eq('id', user.id)
    }

    const res = await request.patch('/api/profile', {
      data: { is_swiper: true },
    })
    expect(res.status()).toBe(422)
    const body = await res.json()
    expect(body.error).toMatch(/school/i)
  })

  test('returns 422 when activating swiper without stripe onboarding', async ({ request }) => {
    // Set school_id but no stripe account
    const res = await request.patch('/api/profile', {
      data: { school_id: schoolId, is_swiper: true },
    })
    expect(res.status()).toBe(422)
    const body = await res.json()
    expect(body.error).toMatch(/payment/i)
  })

  test('activates swiper when school set and stripe onboarded', async ({ request }) => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    // Seed a completed stripe account for the test user
    const { data: existing } = await supabase.auth.admin.listUsers()
    const user = existing?.users?.find((u) => u.email === TEST_EMAIL)
    if (!user) throw new Error('Test user not found')

    await supabase.from('profiles').update({ school_id: schoolId }).eq('id', user.id)
    await supabase.from('stripe_accounts').upsert({
      user_id: user.id,
      stripe_account_id: 'acct_test_swiper_e2e',
      onboarding_complete: true,
    })

    const res = await request.patch('/api/profile', {
      data: { is_swiper: true },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.is_swiper).toBe(true)
  })
})

test.describe('Account page — swiper section', () => {
  test.beforeAll(async () => {
    // Reset test user to non-swiper state before UI tests
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data: existing } = await supabase.auth.admin.listUsers()
    const user = existing?.users?.find((u) => u.email === 'test@goobereats.test')
    if (user) {
      await supabase
        .from('profiles')
        .update({ is_swiper: false, school_id: null })
        .eq('id', user.id)
      await supabase.from('stripe_accounts').delete().eq('user_id', user.id)
    }
  })

  test('shows "Become a Swiper" section for non-swiper', async ({ page }) => {
    await page.goto('/account')
    await expect(page.getByTestId('account-become-swiper-cta')).toBeVisible()
  })

  test('school select and save updates profile', async ({ page }) => {
    await page.goto('/swiper-registration')
    // Select the first school option (not the placeholder)
    const select = page.getByTestId('swiper-reg-school-selector')
    await expect(select).toBeVisible()
    const options = await select.locator('option').all()
    // Find a non-empty option value
    let targetValue = ''
    for (const opt of options) {
      const val = await opt.getAttribute('value')
      if (val && val !== '') {
        targetValue = val
        break
      }
    }
    expect(targetValue).toBeTruthy()
    await select.selectOption(targetValue)
    await page.getByTestId('swiper-reg-save-button').click()
    // After saving, the school name should be displayed and the Continue button enabled
    await expect(page.getByTestId('swiper-reg-continue-button')).toBeEnabled()
  })
})
