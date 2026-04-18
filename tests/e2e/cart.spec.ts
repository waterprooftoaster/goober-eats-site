import { test, expect } from '@playwright/test'
import { navigateToFirstEatery } from './helpers'

test.describe('Anonymous cart flow', () => {
  test('add item to cart, view cart, remove item', async ({ page }) => {
    // Navigate to an eatery
    await navigateToFirstEatery(page)

    // Click first menu item to open modal
    const responsePromise = page.waitForResponse((res) =>
      res.url().includes('/api/menu-items/') && res.url().includes('/options'),
    )
    await page.locator('[data-testid="menu-item-card"]').first().click()
    await responsePromise

    // Get the item name from the modal
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const itemName = await dialog.locator('h2').textContent()
    expect(itemName).toBeTruthy()

    // Click "Add to Cart"
    await dialog.getByRole('button', { name: 'Add to Cart' }).click()

    // Modal should close
    await expect(dialog).not.toBeVisible()

    // Navigate to cart page
    await page.goto('/cart')

    // Cart should show the item name
    await expect(page.getByText(itemName!)).toBeVisible()

    // Remove the item
    await page.getByRole('button', { name: `Remove ${itemName}` }).click()

    // Item should disappear and empty message should show
    await expect(page.getByText('Your cart is empty.')).toBeVisible()
  })
})
