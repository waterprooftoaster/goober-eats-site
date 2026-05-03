/**
 * @file checkout-prefill-real-api.spec.ts
 * @description Live integration spec that hits the real Gemini API exactly
 *   twice — once with a real GrubHub cart screenshot (asserts $118.66 →
 *   11866 cents prefilled) and once with a non-cart UI screenshot (asserts
 *   the input stays empty because Gemini correctly rejects non-cart input).
 *
 *   GROUND TRUTH for tests/grubhub-test-cart.png (analyzed by Opus 4.7):
 *     Restaurant: Jasper Kane Cafe
 *     Items: 18" Pizza ($28.99) + Chicken Wings ($79.99) = $108.98 subtotal
 *     Sales tax: $9.68
 *     Total: $118.66  →  expected cents: 11866
 *
 *   Each test uploads exactly ONE image, which fires exactly ONE
 *   /api/orders/extract-price call → ONE Gemini call. Retries are disabled
 *   to guarantee the 2-call cap. Screenshots prove the result and are
 *   saved under verification/checkout-prefill-real-api/.
 *   Called by: Playwright "authenticated" project
 */

import { test, expect } from '@playwright/test'
import path from 'path'
import { mkdirSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const REAL_CART_FIXTURE = path.resolve(__dirname, '../../grubhub-test-cart.png')
// Existing repo PNG: a goober Eats "Current orders" UI screenshot with no
// dollar amounts visible. Real, decodable, and clearly NOT a delivery-app
// cart, so Gemini should return cents=null.
const BOGUS_FIXTURE = path.resolve(
  __dirname,
  '../../manual/screenshots/01-orderer-in-progress.png',
)
const ARTIFACTS_DIR = path.resolve(__dirname, '../../../verification/checkout-prefill-real-api')
const PREFILL_WAIT_MS = 15000 // covers the 8s app timeout + Gemini latency

test.describe('checkout prefill — REAL Gemini API (live, 2 calls total)', () => {
  test.describe.configure({ retries: 0 })

  test.beforeAll(async () => {
    mkdirSync(ARTIFACTS_DIR, { recursive: true })

    // app/page.tsx only renders HomeUpload when profile.school_id is set;
    // ensure a school exists and the test user is linked to it.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
    )
    const { data: existing } = await supabase
      .from('schools')
      .select('id')
      .limit(1)
    let schoolId = existing?.[0]?.id as string | undefined
    if (!schoolId) {
      const { data: created, error } = await supabase
        .from('schools')
        .insert({ name: 'Test School', slug: 'test-school' })
        .select('id')
        .single()
      if (error || !created) throw new Error(`Failed to seed school: ${error?.message}`)
      schoolId = created.id as string
    }
    const { data: users } = await supabase.auth.admin.listUsers()
    const u = users.users.find((x) => x.email === 'test@goobereats.edu')
    if (!u) throw new Error('Test user not found — did auth.setup.ts run?')
    await supabase.from('profiles').update({ school_id: schoolId }).eq('id', u.id)
  })

  test('real GrubHub cart → input prefilled with 118.66', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('home-page')).toBeVisible()

    await page.getByTestId('home-file-input').setInputFiles(REAL_CART_FIXTURE)
    await expect(page.getByTestId('home-place-order-button')).toBeVisible()

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '01-home-with-real-cart.png'),
      fullPage: false,
    })

    await page.getByTestId('home-place-order-button').click()

    // handlePlaceOrder uploads, kicks off /api/orders/extract-price, then
    // routes to /checkout. From here the prefill effect awaits the live call.
    await page.waitForURL('**/checkout', { timeout: 15000 })
    const input = page.getByTestId('checkout-subtotal-input')
    await expect(input).toBeVisible()

    await expect(input).toHaveValue('118.66', { timeout: PREFILL_WAIT_MS })

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '02-checkout-prefilled-118-66.png'),
      fullPage: true,
    })

    await expect(page.getByTestId('checkout-error-message')).toHaveCount(0)
  })

  test('non-cart UI screenshot → input stays empty (Gemini rejects)', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('home-page')).toBeVisible()

    await page.getByTestId('home-file-input').setInputFiles(BOGUS_FIXTURE)
    await expect(page.getByTestId('home-place-order-button')).toBeVisible()
    await page.getByTestId('home-place-order-button').click()

    await page.waitForURL('**/checkout', { timeout: 15000 })
    const input = page.getByTestId('checkout-subtotal-input')
    await expect(input).toBeVisible()

    // Wait for the prefill effect to settle (skeleton clears either on
    // resolve or after the 8s timeout). Then assert the input is empty.
    await page.waitForFunction(
      () => {
        const skel = document.querySelector('[data-testid="checkout-subtotal-skeleton"]')
        return skel === null
      },
      undefined,
      { timeout: PREFILL_WAIT_MS },
    )

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '03-checkout-empty-on-bogus.png'),
      fullPage: true,
    })

    await expect(input).toHaveValue('')
    await expect(page.getByTestId('checkout-error-message')).toHaveCount(0)
  })
})
