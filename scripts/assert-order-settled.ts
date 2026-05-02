/**
 * @file assert-order-settled.ts
 * @description One-shot CLI wrapper around `assertOrderSettled`. Used by the
 *   Claude-in-the-loop recipe (docs/testing/claude-in-the-loop.md) to verify
 *   the Stripe-side state of an order via a single bash invocation.
 *
 *   Usage: npx tsx scripts/assert-order-settled.ts <orderId>
 *   Exits 0 with JSON summary on success; exits 1 with an error message on failure.
 *   Reads TEST_SUPABASE_URL / TEST_SUPABASE_SECRET_KEY / STRIPE_SECRET_KEY from env.
 *   Called by: docs/testing/claude-in-the-loop.md (final verification step)
 * @dependencies tests/e2e/lib/stripeAssertions
 */

import { assertOrderSettled } from '../tests/e2e/lib/stripeAssertions'

main()

// --- Helpers ---

async function main(): Promise<void> {
  const orderId = process.argv[2]
  if (!orderId) {
    console.error('Usage: npx tsx scripts/assert-order-settled.ts <orderId>')
    process.exit(1)
  }
  try {
    const result = await assertOrderSettled(orderId)
    console.log(JSON.stringify({ stripeAssertion: 'settled', ...result }, null, 2))
    process.exit(0)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error(JSON.stringify({ stripeAssertion: 'failed', error: message }, null, 2))
    process.exit(1)
  }
}
