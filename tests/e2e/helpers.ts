import { type Page, expect } from '@playwright/test'

// Minimum menu items required to satisfy test assertions (e.g. grid count >= 5)
const MIN_MENU_ITEMS = 5

/**
 * Navigate to the homepage and click the first eatery card that has
 * at least MIN_MENU_ITEMS menu items. Skips eateries with sparse or empty
 * menus to keep tests deterministic.
 * Returns the eatery page URL (e.g. /eatery/{uuid}).
 */
export async function navigateToFirstEatery(page: Page): Promise<string> {
  await page.goto('/')
  const cards = page.locator('[data-testid="eatery-card"]')
  await expect(cards.first()).toBeVisible()

  const count = await cards.count()
  for (let i = 0; i < count; i++) {
    await cards.nth(i).click()
    await page.waitForURL(/\/eatery\//)

    const menuItems = page.locator('[data-testid="menu-item-card"]')
    const itemCount = await menuItems.count()
    if (itemCount >= MIN_MENU_ITEMS) {
      return page.url()
    }

    // Not enough items — go back and try next
    await page.goto('/')
    await expect(cards.first()).toBeVisible()
  }

  throw new Error(`No eatery with ${MIN_MENU_ITEMS}+ menu items found on homepage`)
}

/**
 * On an eatery page, click the first menu item and intercept the
 * options API call to extract the menu item ID.
 */
export async function getMenuItemId(page: Page): Promise<string> {
  const responsePromise = page.waitForResponse((res) =>
    res.url().includes('/api/menu-items/') && res.url().includes('/options'),
  )
  await page.locator('[data-testid="menu-item-card"]').first().click()
  const response = await responsePromise
  const url = response.url()
  const match = url.match(/\/api\/menu-items\/([^/]+)\/options/)
  if (!match) throw new Error('Could not extract menu item ID from options URL')
  return match[1]
}

/**
 * Extract the eatery ID from the current eatery page URL.
 */
export function getEateryIdFromUrl(url: string): string {
  const match = url.match(/\/eatery\/([^/?]+)/)
  if (!match) throw new Error('Not on an eatery page')
  return match[1]
}
