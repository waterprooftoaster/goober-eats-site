import { test, expect } from '@playwright/test'
import { navigateToFirstEatery } from './helpers'

test.describe('Eatery page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToFirstEatery(page)
  })

  test('shows eatery name and address', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('[data-testid="eatery-address"]')).toBeVisible()
  })

  test('renders menu items in grid', async ({ page }) => {
    const items = page.locator('[data-testid="menu-item-card"]')
    await expect(items.first()).toBeVisible()
    expect(await items.count()).toBeGreaterThanOrEqual(5)
  })

  test('discounted items show original and market prices', async ({ page }) => {
    // At least one item should have both prices (seeded data includes discounts)
    const originalPrice = page.locator('[data-testid="price-original"]').first()
    const marketPrice = page.locator('[data-testid="price-market"]').first()
    await expect(originalPrice).toBeVisible()
    await expect(marketPrice).toBeVisible()
  })

  test('non-discounted items show single price', async ({ page }) => {
    const currentPrice = page.locator('[data-testid="price-current"]').first()
    await expect(currentPrice).toBeVisible()
  })

  test('clicking menu item opens detail modal', async ({ page }) => {
    // Click the first menu item button
    await page.locator('[data-testid="menu-item-card"]').first().click()

    // Dialog should appear with "Add to Cart" button
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Add to Cart' })).toBeVisible()
  })

  test('modal loads option groups for items with options', async ({ page }) => {
    test.setTimeout(60000)
    // Click first item and wait for options API response
    const responsePromise = page.waitForResponse((res) =>
      res.url().includes('/api/menu-items/') && res.url().includes('/options'),
    )
    await page.locator('[data-testid="menu-item-card"]').first().click()
    const response = await responsePromise
    const data = await response.json()

    if (data.groups && data.groups.length > 0) {
      // Verify option group names appear in the dialog
      const dialog = page.getByRole('dialog')
      for (const group of data.groups) {
        await expect(dialog.getByText(group.name)).toBeVisible()
      }
    }
  })
})
