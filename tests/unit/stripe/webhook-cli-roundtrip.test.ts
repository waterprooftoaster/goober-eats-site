/**
 * @file webhook-cli-roundtrip.test.ts
 * @description Real Stripe CLI roundtrip: spawns `stripe trigger payment_intent.succeeded`
 *   with all required metadata, relies on a separately-running `stripe listen` to forward
 *   the event to the test dev server, and asserts the webhook handler created an `orders`
 *   row in the test Supabase. This is the integration-test counterpart to the trimmed
 *   webhooks.test.ts (which keeps only error-path edge cases the CLI can't synthesize).
 *
 *   Pioneers the hit-real-Supabase pattern in tests/unit/. Builds its own service client
 *   from TEST_SUPABASE_URL + TEST_SUPABASE_SECRET_KEY rather than calling the canonical
 *   `createServiceClient`, which would point at the dev DB.
 *
 *   Required env (else skipped):
 *     - STRIPE_CLI=1 (opt-in flag so default `npm run test` skips this)
 *     - STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY (for stripe listen verification)
 *     - TEST_SUPABASE_URL, TEST_SUPABASE_SECRET_KEY
 *     - `bash scripts/test-money-up.sh` previously executed (test dev server on :3100,
 *       stripe listen forwarding to it)
 *
 *   Called by: STRIPE_CLI=1 npx vitest run tests/unit/stripe/webhook-cli-roundtrip.test.ts
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { execSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SHOULD_RUN = process.env.STRIPE_CLI === '1'

let supabase: SupabaseClient
let schoolId: string

const synthesizedPiIds = new Set<string>()

beforeAll(async () => {
  if (!SHOULD_RUN) return

  const url = process.env.TEST_SUPABASE_URL
  const key = process.env.TEST_SUPABASE_SECRET_KEY
  if (!url || !key) {
    throw new Error('TEST_SUPABASE_URL / TEST_SUPABASE_SECRET_KEY not set')
  }
  supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: school } = await supabase.from('schools').select('id').limit(1).single()
  if (!school) {
    throw new Error('Test DB has no schools row — run npm run test:db:reset')
  }
  schoolId = school.id as string
})

afterEach(async () => {
  if (!SHOULD_RUN || synthesizedPiIds.size === 0) return
  const ids = Array.from(synthesizedPiIds)
  await supabase.from('payments').delete().in('stripe_payment_intent_id', ids)
  await supabase.from('orders').delete().in('stripe_payment_intent_id', ids)
  synthesizedPiIds.clear()
})

describe.skipIf(!SHOULD_RUN)('webhook CLI roundtrip', () => {
  it('payment_intent.succeeded → webhook creates order in test DB', async () => {
    // Use a deterministic, validation-passing screenshot path
    // (matches SCREENSHOT_PATH_RE in app/api/stripe/webhooks/route.ts)
    const screenshotPath = 'pre-checkout/abc1234567/00000000-0000-4000-8000-000000000010.png'

    const triggerOutput = execSync(
      [
        'stripe trigger payment_intent.succeeded',
        `--add 'payment_intent:metadata.school_id=${schoolId}'`,
        `--add 'payment_intent:metadata.restaurant_name=Chipotle'`,
        `--add 'payment_intent:metadata.cart_screenshot_paths=${screenshotPath}'`,
        `--add 'payment_intent:metadata.subtotal_cents=2500'`,
        `--add 'payment_intent:metadata.total_cents=1500'`,
        `--add 'payment_intent:metadata.platform_fee_cents=250'`,
        `--add 'payment_intent:metadata.is_guest=true'`,
        `--add 'payment_intent:metadata.guest_name=CLI Roundtrip'`,
      ].join(' '),
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    )

    // `stripe trigger` prints the synthesized PI id; capture it for cleanup + assertion lookup
    const piMatch = triggerOutput.match(/pi_[A-Za-z0-9]+/)
    if (!piMatch) {
      throw new Error(`stripe trigger did not print a pi_ id. Output:\n${triggerOutput}`)
    }
    const piId = piMatch[0]
    synthesizedPiIds.add(piId)

    // Poll for the order row (give the webhook up to 15s to land)
    const order = await pollForOrder(piId, 15_000)
    expect(order).toBeTruthy()
    expect(order.school_id).toBe(schoolId)
    expect(order.total_cents).toBe(1500)
    expect(order.cart_screenshot_urls).toContain(screenshotPath)
    expect(order.guest_name).toBe('CLI Roundtrip')
    expect(order.orderer_id).toBeNull()

    const { data: payment } = await supabase
      .from('payments')
      .select('amount_cents, platform_fee_cents, status')
      .eq('stripe_payment_intent_id', piId)
      .single()
    expect(payment).toBeTruthy()
    expect(payment!.amount_cents).toBe(1500)
    expect(payment!.platform_fee_cents).toBe(250)
    expect(payment!.status).toBe('succeeded')
  }, 30_000)
})

// --- Helpers ---

interface OrderRow {
  id: string
  school_id: string
  total_cents: number
  cart_screenshot_urls: string[]
  guest_name: string | null
  orderer_id: string | null
}

async function pollForOrder(piId: string, timeoutMs: number): Promise<OrderRow> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const { data } = await supabase
      .from('orders')
      .select('id, school_id, total_cents, cart_screenshot_urls, guest_name, orderer_id')
      .eq('stripe_payment_intent_id', piId)
      .maybeSingle()
    if (data) return data as OrderRow
    await sleep(500)
  }
  throw new Error(`order for PI ${piId} never appeared within ${timeoutMs}ms — is stripe listen running?`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
