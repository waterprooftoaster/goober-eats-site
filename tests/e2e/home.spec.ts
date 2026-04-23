/**
 * @file home.spec.ts
 * @description E2E tests for the homepage upload area.
 *   Called by: Playwright test runner
 */

import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('renders the upload square', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('main')).toBeVisible()
    // Hidden file input is present
    await expect(page.locator('input[type="file"]')).toBeAttached()
  })

  test('Place Order button hidden before file selection', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Place Order/i })).not.toBeVisible()
  })

  test('Place Order button appears after selecting a file', async ({ page }) => {
    await page.goto('/')
    await page.locator('input[type="file"]').setInputFiles({
      name: 'cart.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-image-data'),
    })
    await expect(page.getByRole('button', { name: /Place Order/i })).toBeVisible()
  })
})
