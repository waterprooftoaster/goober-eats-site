import { test, expect } from '@playwright/test'
import { navigateToFirstRestaurant } from './helpers'

test.describe('Cart badge live update', () => {
  test('badge appears with count 1 after adding first item — no page reload', async ({ page }) => {
    await navigateToFirstRestaurant(page)

    // Badge should not be visible before adding anything
    const badge = page.locator('[aria-label="Cart"] span')
    await expect(badge).not.toBeVisible()

    // Open first menu item modal
    const responsePromise = page.waitForResponse((res) =>
      res.url().includes('/api/menu-items/') && res.url().includes('/options'),
    )
    await page.locator('[data-testid="menu-item-card"]').first().click()
    await responsePromise

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Add to cart — no navigation, no reload
    await dialog.getByRole('button', { name: 'Add to Cart' }).click()
    await expect(dialog).not.toBeVisible()

    // Badge should now show 1 without any reload
    await expect(badge).toBeVisible()
    await expect(badge).toHaveText('1')
  })

  test('badge disappears after removing sole item from cart panel — no page reload', async ({ page }) => {
    await navigateToFirstRestaurant(page)

    // Add one item
    const responsePromise = page.waitForResponse((res) =>
      res.url().includes('/api/menu-items/') && res.url().includes('/options'),
    )
    await page.locator('[data-testid="menu-item-card"]').first().click()
    await responsePromise

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const itemName = await dialog.locator('h2').textContent()

    await dialog.getByRole('button', { name: 'Add to Cart' }).click()
    await expect(dialog).not.toBeVisible()

    // Wait for badge to appear
    const badge = page.locator('[aria-label="Cart"] span')
    await expect(badge).toBeVisible()

    // Open cart panel (intercepted as modal)
    await page.locator('[aria-label="Cart"]').click()
    await page.waitForURL(/\/cart/)

    // Remove the item
    await page.getByRole('button', { name: `Remove ${itemName}` }).click()
    await expect(page.getByText('Your cart is empty.')).toBeVisible()

    // Go back — badge should be gone
    await page.goBack()
    await expect(badge).not.toBeVisible()
  })
})
