/**
 * @file home.spec.ts
 * @description E2E tests for the homepage CTA.
 *   Called by: Playwright test runner
 */

import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('renders the Place an Order CTA', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Place an Order' })).toBeVisible()
  })

  test('clicking Place an Order navigates to /order/new', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Place an Order' }).click()
    await page.waitForURL('/order/new', { timeout: 10000 })
  })
})
