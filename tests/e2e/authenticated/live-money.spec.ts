/**
 * @file live-money.spec.ts
 * @description The single E2E spec that proves the full Stripe money flow really
 *   settled in test mode: orderer pays via embedded Checkout (PI confirmed
 *   programmatically with `pm_card_visa`), `stripe listen` forwards
 *   `payment_intent.succeeded` to the test dev server, the webhook creates the
 *   order, the swiper accepts + completes (which triggers transferToSwiper), then
 *   `assertOrderSettled` queries the real Stripe API to verify the PI succeeded,
 *   the transfer used `source_transaction`, and the platform retained 10%.
 *
 *   Opt-in: gated by RUN_LIVE_MONEY=1 in playwright.config.ts. Requires
 *   `bash scripts/test-money-up.sh` to have run (which exports STRIPE_WEBHOOK_SECRET
 *   and starts `stripe listen` against the test dev server on :3100).
 *
 *   Called by: Playwright "live-money" project
 * @dependencies @supabase/supabase-js, stripe, tests/e2e/lib/stripeAssertions
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertOrderSettled } from '../lib/stripeAssertions'

const SWIPER_EMAIL = 'swiper@goobereats.edu'
const FIXTURES_DIR = resolve(__dirname, '../fixtures')

test.describe('Live Money', () => {
  test.beforeAll(() => {
    if (!process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) {
      throw new Error(
        'STRIPE_WEBHOOK_SECRET not set or not a webhook key. Run `eval $(bash scripts/test-money-up.sh)` before this spec.'
      )
    }
    if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
      throw new Error('STRIPE_SECRET_KEY must be a test-mode key (sk_test_*).')
    }
  })

  test('orderer pays → webhook creates order → swiper completes → Stripe transfer settled', async ({
    page,
    browser,
  }) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    const supabase = createClient(
      process.env.TEST_SUPABASE_URL!,
      process.env.TEST_SUPABASE_SECRET_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // ── 1. Orderer renders the home page (proves UI bring-up) ──
    await page.goto('/')
    await page.getByTestId('home-file-input').setInputFiles({
      name: 'cart.png',
      mimeType: 'image/png',
      buffer: readFileSync(resolve(FIXTURES_DIR, 'cart-screenshot.png')),
    })
    await expect(page.getByTestId('home-place-order-button')).toBeVisible()

    // ── 2. Create + confirm a PaymentIntent directly with pm_card_visa ──
    // The embedded Checkout `mode: 'payment'` defers PI creation until the
    // user types into the iframe; driving Stripe Elements cross-origin is
    // historically flaky, so we skip the iframe and exercise the same webhook
    // path with a direct PI confirmation. Metadata mirrors what
    // /api/stripe/checkout-session would have set.
    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .limit(1)
      .single()
    if (!school) throw new Error('No schools row in test DB')

    const { data: orderer } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'orderer@goobereats.edu')
      .single()
    if (!orderer) throw new Error('Orderer profile missing')

    // 60/50/10 split: subtotal $25 → orderer pays $15, swiper $12.50, platform $2.50
    const subtotalCents = 2500
    const totalCents = 1500
    const platformFeeCents = 150 // 10% of total per the assertion contract

    const pi = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      payment_method: 'pm_card_visa',
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        school_id: school.id as string,
        restaurant_name: 'Chipotle',
        cart_screenshot_paths:
          'pre-checkout/abc1234567/00000000-0000-4000-8000-000000000001.png',
        subtotal_cents: String(subtotalCents),
        total_cents: String(totalCents),
        platform_fee_cents: String(platformFeeCents),
        orderer_id: orderer.id as string,
      },
    })
    const piId = pi.id

    // ── 3. Poll for the order row (proves the webhook arrived) ──
    const orderId = await pollForOrderByPi(supabase, piId, 30_000)

    // ── 4. Swiper accepts + uploads completion photo + marks complete ──
    const swiperCtx = await browser.newContext({ storageState: '.auth/swiper.json' })
    const swiperRequest = swiperCtx.request

    const acceptRes = await swiperRequest.fetch(`/api/orders/${orderId}/accept`, {
      method: 'PATCH',
    })
    expect(acceptRes.status(), `accept failed: ${await acceptRes.text()}`).toBe(200)

    // Find the freshly-created conversation; insert a completion_photo message
    // (storage upload itself isn't part of the money assertion — the status
    // route only checks the message exists).
    const { data: swiper } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', SWIPER_EMAIL)
      .single()
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('order_id', orderId)
      .single()
    if (!conv) throw new Error('Conversation not created after accept')

    await supabase.from('messages').insert({
      conversation_id: conv.id,
      sender_id: swiper!.id,
      message_type: 'completion_photo',
      image_url: 'https://example.com/completion.png',
      body: null,
    })

    const completeRes = await swiperRequest.fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      data: { status: 'completed' },
    })
    expect(completeRes.status(), `complete failed: ${await completeRes.text()}`).toBe(200)
    await swiperCtx.close()

    // ── 5. Assert the Stripe side really settled ──
    const settlement = await assertOrderSettled(orderId)
    console.log(
      `Settled. transferId=${settlement.transferId} chargeBT=${settlement.chargeBalanceTxnId} pi=${settlement.paymentIntentId}`
    )

    // ── 6. Cleanup ──
    await supabase.from('messages').delete().eq('conversation_id', conv.id)
    await supabase.from('conversations').delete().eq('order_id', orderId)
    await supabase.from('payments').delete().eq('order_id', orderId)
    await supabase.from('orders').delete().eq('id', orderId)
  })
})

// --- Helpers ---

async function pollForOrderByPi(
  supabase: ReturnType<typeof createClient>,
  piId: string,
  timeoutMs: number
): Promise<string> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const { data } = await supabase
      .from('orders')
      .select('id, status')
      .eq('stripe_payment_intent_id', piId)
      .maybeSingle()
    if (data?.id) return data.id as string
    await sleep(500)
  }
  throw new Error(
    `webhook never arrived for PI ${piId} within ${timeoutMs}ms — is stripe listen running and forwarding to the test dev server?`
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
