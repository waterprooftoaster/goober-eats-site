/**
 * @file image-refactor.spec.ts
 * @description Visual verification spec for the unified image pipeline.
 *   Captures the four changed surfaces (swiper detail modal, home dropzone,
 *   checkout cart preview, completion view) at three viewports each, plus
 *   aspect-band cases (square / 9:16 / 9:19.5) showing identical render
 *   container size, and the rejection case for an out-of-band 16:9 upload.
 *   Called by: npx playwright test tests/e2e/verification/image-refactor.spec.ts
 * @dependencies @playwright/test, /tmp/fixture-*.png (run scripts/make-fixtures.js first)
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const VIEWPORTS: Array<{ name: string; width: number; height: number }> = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

const VERIFICATION_DIR = path.resolve(__dirname, '../../../verification')

const SWIPER_EMAIL = 'nyu-swiper@goober.test'
const ORDERER_EMAIL = 'new-school-orderer@goober.test'
const DEMO_PASSWORD = 'GooberDemo!1'

const FIXTURE_TALL = '/tmp/tall-cart-mock.png'      // 390x844 ~9:19.5 (the seeded order)
const FIXTURE_SQUARE = '/tmp/fixture-square.png'    // 1024x1024 in-band square
const FIXTURE_9X16 = '/tmp/fixture-9x16.png'        // 720x1280 phone-portrait
const FIXTURE_9X195 = '/tmp/fixture-9x195.png'      // 720x1560 tallest in-band
const FIXTURE_LANDSCAPE = '/tmp/fixture-16x9.png'   // 1600x900 out-of-band

async function signIn(page: import('@playwright/test').Page, email: string): Promise<void> {
  await page.goto('/auth/login')
  await page.getByTestId('auth-email-input').fill(email)
  await page.getByTestId('auth-continue-button').click()
  await page.getByTestId('auth-password-input').fill(DEMO_PASSWORD)
  await page.getByTestId('auth-signin-button').click()
  await page.waitForURL('/', { timeout: 10000 })
}

async function dismissChatPanel(page: import('@playwright/test').Page): Promise<void> {
  const closeButtons = page.getByLabel('Close chat')
  while ((await closeButtons.count()) > 0) {
    await closeButtons.first().click()
    await page.waitForTimeout(150)
  }
}

test.describe('image refactor — visual verification', () => {
  test.describe.configure({ mode: 'serial' })

  for (const vp of VIEWPORTS) {
    test(`swiper detail modal — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await signIn(page, SWIPER_EMAIL)
      await page.goto('/swiper/orders')
      await page.getByTestId('order-card').first().click()
      await expect(page.getByTestId('swiper-order-detail-modal')).toBeVisible()
      await page.getByTestId('swiper-order-screenshot').waitFor({ state: 'visible' })
      await page.waitForTimeout(300)
      await page.screenshot({
        path: path.join(VERIFICATION_DIR, `swiper-modal-${vp.name}.png`),
        fullPage: false,
      })
    })

    test(`home dropzone empty + preview — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await signIn(page, ORDERER_EMAIL)
      await page.goto('/')
      await dismissChatPanel(page)
      await expect(page.getByTestId('home-dropzone')).toBeVisible()
      await page.waitForTimeout(200)
      await page.screenshot({
        path: path.join(VERIFICATION_DIR, `home-dropzone-empty-${vp.name}.png`),
        fullPage: false,
      })

      await page.getByTestId('home-file-input').setInputFiles(FIXTURE_9X195)
      await page.waitForTimeout(400)
      await page.screenshot({
        path: path.join(VERIFICATION_DIR, `home-dropzone-preview-${vp.name}.png`),
        fullPage: false,
      })
    })

    test(`checkout cart preview — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await signIn(page, ORDERER_EMAIL)
      await page.goto('/')
      await dismissChatPanel(page)
      await page.getByTestId('home-file-input').setInputFiles(FIXTURE_9X195)
      await page.getByTestId('home-place-order-button').click()
      await page.waitForURL('/checkout', { timeout: 15000 })
      await dismissChatPanel(page)
      await page.locator('img[alt^="Cart screenshot"]').first().waitFor({ state: 'visible' })
      await page.waitForTimeout(400)
      await page.screenshot({
        path: path.join(VERIFICATION_DIR, `checkout-preview-${vp.name}.png`),
        fullPage: false,
      })
    })
  }

  // Aspect-band: same render container size across square / 9:16 / 9:19.5
  for (const vp of VIEWPORTS) {
    for (const fixture of [
      { name: 'square', file: FIXTURE_SQUARE },
      { name: '9x16', file: FIXTURE_9X16 },
      { name: '9x195', file: FIXTURE_9X195 },
    ]) {
      test(`home preview aspect — ${fixture.name} — ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await signIn(page, ORDERER_EMAIL)
        await page.goto('/')
        await dismissChatPanel(page)
        await page.getByTestId('home-file-input').setInputFiles(fixture.file)
        await page.waitForTimeout(400)
        await page.screenshot({
          path: path.join(VERIFICATION_DIR, `aspect-${fixture.name}-${vp.name}.png`),
          fullPage: false,
        })
      })
    }
  }

  // Rejection: 16:9 landscape should produce an error and NOT navigate to checkout
  test('rejection — 16:9 landscape upload — phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, ORDERER_EMAIL)
    await page.goto('/')
    await dismissChatPanel(page)
    await page.getByTestId('home-file-input').setInputFiles(FIXTURE_LANDSCAPE)
    await page.getByTestId('home-place-order-button').click()
    // The error message renders below the dropzone; URL must NOT navigate to /checkout
    await page.waitForTimeout(800)
    expect(page.url()).not.toContain('/checkout')
    await expect(page.getByTestId('home-error-message')).toBeVisible()
    await page.screenshot({
      path: path.join(VERIFICATION_DIR, 'rejection-landscape-phone.png'),
      fullPage: false,
    })
  })
})
