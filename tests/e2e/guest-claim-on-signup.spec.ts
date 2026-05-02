/**
 * @file guest-claim-on-signup.spec.ts
 * @description E2E: a user who placed a guest order, then signs up, has the
 *   order claimed automatically (orderer_id rebound, guest cookie cleared,
 *   conversation row mirrors the new orderer_id). After onboarding the
 *   order appears on /current-orders.
 *   Called by: Playwright "chromium" (unauthenticated) project
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const SUBTOTAL_CENTS = 1500
const TOTAL_CENTS = 1650

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

let createdUserId: string | null = null
let createdOrderId: string | null = null
let testEmail: string | null = null

test.afterEach(async () => {
  const supabase = makeSupabase()
  if (createdOrderId) {
    await supabase.from('orders').delete().eq('id', createdOrderId)
    createdOrderId = null
  }
  if (createdUserId) {
    await supabase.from('profiles').delete().eq('id', createdUserId)
    await supabase.auth.admin.deleteUser(createdUserId)
    createdUserId = null
  }
  testEmail = null
})

test.describe('Guest order claim on sign-up', () => {
  test('a guest order is claimed and appears on /current-orders after sign-up', async ({ page, context }) => {
    const supabase = makeSupabase()
    const { data: school } = await supabase
      .from('schools')
      .select('id, name')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
    if (!school) throw new Error('No schools found — seed required')

    const guestToken = randomUUID()
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        orderer_id: null,
        swiper_id: null,
        school_id: school.id,
        restaurant_name: 'Claim Sushi Spot',
        cart_screenshot_urls: [`pre-checkout/claim-e2e/${randomUUID()}.png`],
        subtotal_cents: SUBTOTAL_CENTS,
        total_cents: TOTAL_CENTS,
        status: 'open',
        guest_name: 'Claim E2E Guest',
        guest_access_token: guestToken,
      })
      .select('id')
      .single()
    if (orderError || !order) throw new Error(`Failed to create guest order: ${orderError?.message}`)
    createdOrderId = order.id

    // Plant the guest cookie before navigating (mirrors the production
    // checkout-return cookie set by the Stripe success route).
    await context.addCookies([
      {
        name: `guest_order_token_${order.id}`,
        value: guestToken,
        domain: 'localhost',
        path: '/',
      },
    ])

    // Sign up with a fresh email — claim runs in completeOnboarding(), not
    // in the sign-up branch of authenticate(), per the agreed plan.
    const suffix = randomUUID().slice(0, 8)
    testEmail = `claim-e2e-${suffix}@goobereats.edu`
    const password = 'claimtestpw123'

    await page.goto('/auth/login')
    await page.getByTestId('auth-email-input').fill(testEmail)
    await page.getByTestId('auth-continue-button').click()
    await page.getByTestId('auth-password-input').fill(password)
    await page.getByTestId('auth-password-confirm-input').fill(password)
    await page.getByTestId('auth-signup-button').click()

    // Onboarding step 1 (name)
    await page.getByTestId('auth-fullname-input').fill('Claim Tester')
    await page.getByTestId('auth-name-continue-button').click()

    // Onboarding step 2 (school) — Combobox; mirrors auth.spec.ts pattern.
    // Use the seeded school's actual name (not a hard-coded value) so this
    // works against any deterministic seed.
    const schoolInput = page.getByTestId('auth-school-input').getByRole('combobox')
    await schoolInput.fill(school.name)
    await schoolInput.press('ArrowDown')
    await schoolInput.press('Enter')
    await expect(page.locator('input[name="school_id"]')).not.toHaveValue('')
    await page.getByTestId('auth-onboarding-complete-button').click()

    // Lands on / after success.
    await page.waitForURL('/', { timeout: 15000 })

    // Capture the new user's id for cleanup.
    const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
    const newUser = users?.users?.find((u) => u.email === testEmail)
    if (newUser) createdUserId = newUser.id

    // The claimed order must appear on /current-orders. Scope to the order
    // card (article role) to avoid matching the same name in chat bubbles or
    // duplicate-rendered (mobile/desktop) spans.
    await page.goto('/current-orders')
    await expect(
      page.getByRole('article').getByText('Claim Sushi Spot', { exact: true }).first()
    ).toBeVisible({ timeout: 10000 })

    // The guest cookie must have been cleared in the same response that
    // returned { success: true } from completeOnboarding.
    const cookies = await context.cookies()
    const guestCookieStill = cookies.find((c) => c.name === `guest_order_token_${order.id}`)
    expect(guestCookieStill).toBeUndefined()

    // DB state: orderer_id is now set, guest_access_token is null.
    const { data: claimed } = await supabase
      .from('orders')
      .select('orderer_id, guest_access_token, anon_user_id')
      .eq('id', order.id)
      .single()
    expect(claimed?.orderer_id).toBe(createdUserId)
    expect(claimed?.guest_access_token).toBeNull()
    expect(claimed?.anon_user_id).toBeNull()
  })
})
