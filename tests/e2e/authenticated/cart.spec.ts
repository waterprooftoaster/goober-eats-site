import { test, expect } from '@playwright/test'
import { navigateToFirstEatery } from '../helpers'

test.describe('Authenticated cart', () => {
  test('add item as logged-in user and persist across reload', async ({ page }) => {
    // Navigate to an eatery
    await navigateToFirstEatery(page)

    // Click first menu item
    const responsePromise = page.waitForResponse((res) =>
      res.url().includes('/api/menu-items/') && res.url().includes('/options'),
    )
    await page.locator('[data-testid="menu-item-card"]').first().click()
    await responsePromise

    // Get item name and add to cart
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const itemName = await dialog.locator('h2').textContent()
    await dialog.getByRole('button', { name: 'Add to Cart' }).click()
    await expect(dialog).not.toBeVisible()

    // Navigate to cart
    await page.goto('/cart')
    await expect(page.getByText(itemName!)).toBeVisible()

    // Reload — cart should persist (user_id based, not session)
    await page.reload()
    await expect(page.getByText(itemName!)).toBeVisible()

    // Checkout link should be visible
    await expect(page.getByRole('button', { name: 'Checkout' })).toBeVisible()
  })
})
