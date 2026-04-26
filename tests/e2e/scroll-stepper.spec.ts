/**
 * @file scroll-stepper.spec.ts
 * @description E2E assertions for ScrollStepperSection — verifies sticky pin
 *   trigger, sticky behavior during animation, instant unstick with zero gap to
 *   InfoColumns post-unstick, X-axis agnosticism, and reverse-scroll cleanliness.
 *   Called by: Playwright runner (chromium project)
 * @dependencies @playwright/test
 */

import { test, expect, Page } from '@playwright/test'

const RECT = '.step-circle-container'
const NEXT = '[data-testid="info-columns"]'

interface Box {
  top: number
  bottom: number
  left: number
  right: number
  height: number
  width: number
}

async function box(page: Page, sel: string): Promise<Box> {
  return page.locator(sel).first().evaluate((el: Element) => {
    const r = (el as HTMLElement).getBoundingClientRect()
    return {
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
      height: r.height,
      width: r.width,
    }
  })
}

async function vh(page: Page): Promise<number> {
  return page.evaluate(() => window.innerHeight)
}

async function engagementY(page: Page): Promise<number> {
  return page.evaluate(() => {
    const r = document.querySelector('.step-circle-container')!.getBoundingClientRect()
    return window.scrollY + r.top - (window.innerHeight - r.height) / 2
  })
}

async function setScroll(page: Page, y: number): Promise<void> {
  await page.evaluate((target) => window.scrollTo(0, target), y)
  await page.waitForTimeout(700)
}

async function currentStep(page: Page): Promise<number> {
  return page.evaluate(() => {
    const indicators = Array.from(document.querySelectorAll('.step-indicator-inner')) as HTMLElement[]
    return indicators.filter((el) => {
      const bg = window.getComputedStyle(el).backgroundColor
      return bg === 'rgb(0, 0, 0)'
    }).length
  })
}

const COVER_BASE_URL = process.env.COVER_BASE_URL ?? 'http://localhost:3001'

test.describe('ScrollStepperSection — sticky pin', () => {
  test.use({ baseURL: COVER_BASE_URL })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    await page.waitForSelector(RECT)
  })

  test('A — engagement: rectangle pins at viewport center', async ({ page }) => {
    const v = await vh(page)
    const eY = await engagementY(page)
    await setScroll(page, eY + 100)
    const r = await box(page, RECT)
    const expectedTop = (v - r.height) / 2
    expect(Math.abs(r.top - expectedTop)).toBeLessThanOrEqual(4)
  })

  test('B — trigger precision: step flips at rect.top crossing stickyTop', async ({ page }) => {
    const eY = await engagementY(page)
    await setScroll(page, eY - 50)
    const before = await currentStep(page)
    expect(before).toEqual(1)
    await setScroll(page, eY + 350)
    const after = await currentStep(page)
    expect(after).toBeGreaterThanOrEqual(2)
  })

  test('C — pinned during animation: rectangle stays at viewport center across scroll deltas', async ({ page }) => {
    const v = await vh(page)
    const eY = await engagementY(page)
    for (const delta of [50, 200, 400, 600, 800]) {
      await setScroll(page, eY + delta)
      const r = await box(page, RECT)
      const expectedTop = (v - r.height) / 2
      expect(Math.abs(r.top - expectedTop)).toBeLessThanOrEqual(4)
    }
  })

  test('D — instant unstick: zero gap to InfoColumns after release', async ({ page }) => {
    const eY = await engagementY(page)
    await setScroll(page, eY + 1100)
    const r1 = await box(page, RECT)
    const n1 = await box(page, NEXT)
    expect(Math.abs(n1.top - r1.bottom)).toBeLessThanOrEqual(2)

    await setScroll(page, eY + 1300)
    const r2 = await box(page, RECT)
    expect(r2.top).toBeLessThan(r1.top - 90)
    const n2 = await box(page, NEXT)
    expect(Math.abs(n2.top - r2.bottom)).toBeLessThanOrEqual(2)
  })

  test('E — X-axis agnostic: parent margin-left does not break pin behavior', async ({ page }) => {
    await page.evaluate(() => {
      const section = document.querySelector('.step-circle-container')!.closest('section')!
      ;(section as HTMLElement).style.marginLeft = '200px'
    })
    const v = await vh(page)
    const eY = await engagementY(page)
    await setScroll(page, eY + 300)
    const r = await box(page, RECT)
    const expectedTop = (v - r.height) / 2
    expect(Math.abs(r.top - expectedTop)).toBeLessThanOrEqual(4)
  })

  test('F — scroll up reverses cleanly', async ({ page }) => {
    const v = await vh(page)
    const eY = await engagementY(page)
    await setScroll(page, eY + 600)
    const rDeep = await box(page, RECT)
    const expectedTop = (v - rDeep.height) / 2
    expect(Math.abs(rDeep.top - expectedTop)).toBeLessThanOrEqual(4)

    await setScroll(page, eY - 100)
    expect(await currentStep(page)).toEqual(1)
  })

  test('G — screenshot evidence at four key positions', async ({ page }, testInfo) => {
    const eY = await engagementY(page)

    await setScroll(page, Math.max(0, eY - 100))
    await testInfo.attach('before-trigger.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })

    await setScroll(page, eY + 450)
    await testInfo.attach('mid-animation.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })

    await setScroll(page, eY + 900)
    await testInfo.attach('at-unstick.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })

    await setScroll(page, eY + 1500)
    await testInfo.attach('post-unstick.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
  })
})
