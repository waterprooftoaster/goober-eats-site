/**
 * @file sdk.ts
 * @description Lazily-initialized Stripe SDK singleton. Runtime-agnostic — safe to
 *   import from Next.js server contexts, vitest, and tsx scripts. Production code
 *   should import the `server-only`-marked re-export from `lib/stripe/client.ts`;
 *   only seed/CLI scripts that run under tsx (where `server-only` throws) should
 *   import this module directly.
 *   Called by: lib/stripe/client.ts, scripts/lib/stripe-seed.ts
 * @dependencies stripe
 */

import Stripe from 'stripe'

let _stripe: Stripe | null = null

/**
 * Returns the lazily-initialized Stripe SDK singleton.
 * @returns Stripe instance configured with STRIPE_SECRET_KEY
 * @called-by lib/stripe/client.ts:getStripe, scripts/lib/stripe-seed.ts
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    })
  }
  return _stripe
}
