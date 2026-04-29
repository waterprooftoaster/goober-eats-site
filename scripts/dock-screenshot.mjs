// One-off verification script: captures mobile screenshots of the bottom-dock
// redesign in different states. Not part of the production code path.
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile } from 'node:fs/promises'

const OUT_DIR = 'screenshots/dock'
const SWIPER = { email: 'nyu-swiper@goober.test', password: 'GooberDemo!1' }
const ORDERER = { email: 'nyu-orderer@goober.test', password: 'GooberDemo!1' }

async function loadEnv() {
  const env = await readFile('.env.local', 'utf8')
  const lines = env.split('\n').filter((l) => l && !l.startsWith('#'))
  return Object.fromEntries(lines.map((l) => l.split('=', 2)))
}

async function login(page, creds, baseUrl) {
  await page.goto(`${baseUrl}/auth/login`)
  await page.getByTestId('auth-email-input').fill(creds.email)
  await page.getByTestId('auth-continue-button').click()
  await page.waitForTimeout(600)
  await page.getByTestId('auth-password-input').first().fill(creds.password)
  const signin = page.getByTestId('auth-signin-button')
  const signup = page.getByTestId('auth-signup-button')
  if (await signin.count()) await signin.click()
  else await signup.click()
  await page.waitForURL((u) => !u.pathname.startsWith('/auth/login'), { timeout: 10000 })
}

async function shoot(page, name) {
  await page.waitForTimeout(500)
  const path = `${OUT_DIR}/${name}.png`
  await page.screenshot({ path, fullPage: false })
  console.log(`  saved ${path}`)
}

async function dumpFixedBottom(page) {
  return page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('body *'))
    return all
      .filter((el) => {
        const cs = getComputedStyle(el)
        if (cs.position !== 'fixed') return false
        const r = el.getBoundingClientRect()
        return r.bottom > window.innerHeight - 200 && r.width > 50 && r.height > 10
      })
      .map((el) => {
        const r = el.getBoundingClientRect()
        return {
          tag: el.tagName,
          testid: el.getAttribute('data-testid'),
          cls: (el.className || '').toString().slice(0, 120),
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          text: (el.textContent || '').trim().slice(0, 40),
        }
      })
  })
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const env = await loadEnv()
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001'
  console.log(`base url: ${baseUrl}`)

  // Wipe all orders + payments + conversations + messages and re-seed for a clean slate.
  const cleanupSupa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)
  await cleanupSupa.from('messages').delete().not('id', 'is', null)
  await cleanupSupa.from('conversations').delete().not('id', 'is', null)
  await cleanupSupa.from('payments').delete().not('id', 'is', null)
  await cleanupSupa.from('orders').delete().not('id', 'is', null)
  // Re-insert the seeded Chipotle open order
  const { data: seedOrderer } = await cleanupSupa.from('profiles').select('id, school_id').eq('email', ORDERER.email).single()
  if (seedOrderer) {
    await cleanupSupa.from('orders').insert({
      orderer_id: seedOrderer.id,
      school_id: seedOrderer.school_id,
      restaurant_name: 'Chipotle',
      cart_screenshot_urls: ['pre-checkout/seed/chipotle.png'],
      stripe_payment_intent_id: `pi_dock_seed_${Date.now()}`,
      subtotal_cents: 2500,
      total_cents: 1500,
      status: 'open',
    })
  }

  const browser = await chromium.launch()

  // -- Swiper context: capture circle-only and chat-mode dock
  const swiperCtx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const sp = await swiperCtx.newPage()

  console.log('1) anon home — no dock expected')
  await sp.goto(`${baseUrl}/`)
  await shoot(sp, '01-anon-home')

  console.log('2) swiper home — circle only')
  await login(sp, SWIPER, baseUrl)
  await sp.goto(`${baseUrl}/`)
  await shoot(sp, '02-swiper-home')

  console.log('3) swiper queue page')
  await sp.goto(`${baseUrl}/swiper/orders`)
  await sp.waitForTimeout(500)
  await shoot(sp, '03-swiper-queue')

  console.log('4) accept the seeded order to get one active swiper panel')
  const card = sp.getByTestId('pending-orders-list').locator('button, [role="button"]').first()
  if (await card.count()) {
    await card.click()
    await sp.waitForTimeout(400)
    await shoot(sp, '04-swiper-modal')
    await sp.getByTestId('swiper-accept-button').click()
    await sp.waitForTimeout(1500)
    await shoot(sp, '05-after-accept-expanded')
    await sp.keyboard.press('Escape')
    await sp.waitForTimeout(1500)
    await shoot(sp, '06-swiper-chat-mode')
    console.log('  bottom-fixed (chat mode):', JSON.stringify(await dumpFixedBottom(sp)))
  } else {
    console.log('  (no pending order — re-seed first)')
  }

  await swiperCtx.close()

  // -- Orderer context with 1 active order: should see "View 1 active order"
  const ordererSingleCtx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const sop = await ordererSingleCtx.newPage()
  console.log('6b) orderer login → single-order redirect pill')
  await login(sop, ORDERER, baseUrl)
  await sop.goto(`${baseUrl}/`)
  await sop.waitForTimeout(1500)
  await shoot(sop, '06b-orderer-single-redirect')
  console.log('  bottom-fixed (single):', JSON.stringify(await dumpFixedBottom(sop)))
  await ordererSingleCtx.close()

  // -- Multi-order setup: insert a second open order for the orderer via service role
  console.log('7) seed a second open order for the orderer (service role)')
  const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)
  const { data: orderer } = await supa.from('profiles').select('id, school_id').eq('email', ORDERER.email).single()
  if (!orderer) throw new Error('orderer profile not found — run npx tsx scripts/seed.ts first')
  const piId = `pi_dock_test_${Date.now()}`
  const { error: insertErr } = await supa.from('orders').insert({
    orderer_id: orderer.id,
    school_id: orderer.school_id,
    restaurant_name: 'Sweetgreen',
    cart_screenshot_urls: ['pre-checkout/seed/dock-test.png'],
    stripe_payment_intent_id: piId,
    subtotal_cents: 2500,
    total_cents: 1500,
    status: 'open',
  })
  if (insertErr) console.warn('  insert second order err:', insertErr.message)
  else console.log('  inserted second open order')

  // -- Orderer context: should see 2 active orders → redirect pill
  const ordererCtx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const op = await ordererCtx.newPage()

  console.log('8) orderer login → multi-order redirect pill')
  await login(op, ORDERER, baseUrl)
  await op.goto(`${baseUrl}/`)
  await op.waitForTimeout(1500)
  await shoot(op, '08-orderer-multi-redirect')
  console.log('  bottom-fixed (multi):', JSON.stringify(await dumpFixedBottom(op)))

  console.log('9) tap redirect pill → /current-orders')
  const pill = op.getByTestId('chat-panel-header').first()
  if (await pill.count()) {
    await pill.click()
    await op.waitForTimeout(1000)
    await shoot(op, '09-current-orders')
    console.log('  url:', op.url())
  }

  await ordererCtx.close()

  // -- Desktop swiper + desktop orderer (multi)
  console.log('10) desktop swiper queue')
  const dCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const dp = await dCtx.newPage()
  await login(dp, SWIPER, baseUrl)
  await dp.goto(`${baseUrl}/swiper/orders`)
  await dp.waitForTimeout(500)
  await shoot(dp, '10-desktop-swiper')
  await dCtx.close()

  console.log('11) desktop orderer on UPLOAD page → inline dock at upload-page width')
  const dCtxO = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const dpo = await dCtxO.newPage()
  await login(dpo, ORDERER, baseUrl)
  await dpo.goto(`${baseUrl}/`)
  await dpo.waitForTimeout(1500)
  await shoot(dpo, '11-desktop-orderer-upload')
  console.log('  fixed @ bottom (desktop upload):', JSON.stringify(await dumpFixedBottom(dpo)))
  // Find the inline dock element directly
  const inlineDock = await dpo.evaluate(() => {
    const el = document.querySelector('[data-testid="desktop-upload-dock"]')
    if (!el) return null
    const r = el.getBoundingClientRect()
    // Also grab the dropzone position so we can confirm x-alignment
    const dz = document.querySelector('[data-testid="home-dropzone"]')?.getBoundingClientRect()
    return {
      dock: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), text: el.textContent?.trim().slice(0, 40) },
      dropzone: dz ? { x: Math.round(dz.x), w: Math.round(dz.width) } : null,
    }
  })
  console.log('  inline dock:', JSON.stringify(inlineDock))
  // Full-page screenshot to show the inline placement below other content
  await dpo.screenshot({ path: `${OUT_DIR}/11-desktop-orderer-upload-fullpage.png`, fullPage: true })

  console.log('12) desktop orderer on /current-orders → no dock anywhere')
  await dpo.goto(`${baseUrl}/current-orders`)
  await dpo.waitForTimeout(1000)
  await shoot(dpo, '12-desktop-current-orders-no-dock')
  console.log('  fixed @ bottom (desktop /current-orders):', JSON.stringify(await dumpFixedBottom(dpo)))
  const anyDock = await dpo.evaluate(() => !!document.querySelector('[data-testid="bottom-dock"], [data-testid="desktop-upload-dock"]'))
  console.log('  any dock present:', anyDock)
  await dCtxO.close()

  // -- Cleanup the test order
  await supa.from('orders').delete().eq('stripe_payment_intent_id', piId)

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
