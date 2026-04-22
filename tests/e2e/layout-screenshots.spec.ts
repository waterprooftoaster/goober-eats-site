/**
 * @file layout-screenshots.spec.ts
 * @description Visual snapshot tests that capture page layout screenshots for key routes.
 *   Called by: Playwright test runner
 */

import { test } from '@playwright/test'
import path from 'path'

const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots')

test('phone 375px — homepage CTA', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'home-phone-375.png'),
    fullPage: true,
  })
})

test('tablet 768px — homepage CTA', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'home-tablet-768.png'),
    fullPage: true,
  })
})

test('phone 375px — order new page', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/order/new')
  await page.waitForLoadState('networkidle')
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'order-new-phone-375.png'),
    fullPage: true,
  })
})
