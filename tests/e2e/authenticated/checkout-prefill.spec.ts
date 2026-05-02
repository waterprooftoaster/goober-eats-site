/**
 * @file checkout-prefill.spec.ts
 * @description E2E tests for the Gemini auto-pricing prefill on /checkout.
 *   Seeds sessionStorage to bypass the home→upload pipeline so the spec
 *   exercises only the prefill behavior. Two scenarios: (1) sessionStorage
 *   carries a resolved cents value → input is prefilled; (2) no cents and
 *   no in-flight cache → input stays empty with no error UI.
 *   Called by: Playwright "authenticated" project
 */

import { test, expect } from '@playwright/test'

const VALID_PATH = 'pre-checkout/abcdefghij/00000000-0000-4000-8000-000000000010.jpg'
const PENDING_SCREENSHOTS_KEY = 'pending_screenshots'
const PENDING_SUBTOTAL_CENTS_KEY = 'pending_subtotal_cents'

test.describe('checkout prefill — Gemini auto-pricing', () => {
  test('input is prefilled from sessionStorage subtotal_cents', async ({ page }) => {
    // Seed before navigation so the mount effect sees both keys.
    await page.goto('/')
    await page.evaluate(
      ([screenshotsKey, subtotalKey, path]) => {
        sessionStorage.setItem(screenshotsKey, JSON.stringify([path]))
        sessionStorage.setItem(subtotalKey, '1234')
      },
      [PENDING_SCREENSHOTS_KEY, PENDING_SUBTOTAL_CENTS_KEY, VALID_PATH] as const,
    )

    await page.goto('/checkout')

    const input = page.getByTestId('checkout-subtotal-input')
    await expect(input).toBeVisible()
    await expect(input).toHaveValue('12.34')
    await expect(page.getByTestId('checkout-error-message')).toHaveCount(0)
  })

  test('input stays empty when no cents value is available (no error UI)', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(
      ([screenshotsKey, subtotalKey, path]) => {
        sessionStorage.setItem(screenshotsKey, JSON.stringify([path]))
        sessionStorage.removeItem(subtotalKey)
      },
      [PENDING_SCREENSHOTS_KEY, PENDING_SUBTOTAL_CENTS_KEY, VALID_PATH] as const,
    )

    await page.goto('/checkout')

    const input = page.getByTestId('checkout-subtotal-input')
    await expect(input).toBeVisible()
    await expect(input).toHaveValue('')
    await expect(page.getByTestId('checkout-error-message')).toHaveCount(0)
  })

  test('user edit is not clobbered by a late prefill resolution', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(
      ([screenshotsKey, subtotalKey, path]) => {
        sessionStorage.setItem(screenshotsKey, JSON.stringify([path]))
        sessionStorage.removeItem(subtotalKey)
      },
      [PENDING_SCREENSHOTS_KEY, PENDING_SUBTOTAL_CENTS_KEY, VALID_PATH] as const,
    )

    await page.goto('/checkout')
    const input = page.getByTestId('checkout-subtotal-input')
    await input.fill('25.00')
    // Late writes to sessionStorage must not overwrite a typed value.
    await page.evaluate(
      ([subtotalKey]) => {
        sessionStorage.setItem(subtotalKey, '1234')
      },
      [PENDING_SUBTOTAL_CENTS_KEY] as const,
    )
    await expect(input).toHaveValue('25.00')
  })
})
