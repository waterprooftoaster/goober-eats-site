/**
 * @file home.spec.ts
 * @description E2E tests for the homepage upload area.
 *   Called by: Playwright test runner
 */

import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('renders the upload square', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('home-page')).toBeVisible()
    // Hidden file input is present
    await expect(page.getByTestId('home-file-input')).toBeAttached()
  })

  test('Place Order button hidden before file selection', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('home-place-order-button')).not.toBeVisible()
  })

  test('Place Order button appears after selecting a file', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('home-file-input').setInputFiles({
      name: 'cart.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-image-data'),
    })
    await expect(page.getByTestId('home-place-order-button')).toBeVisible()
  })
})
