/**
 * @file client.ts
 * @description Lazily-initialized singleton Stripe SDK client (server-only).
 *   Called by: lib/stripe/connect.ts, lib/stripe/transfer.ts, app/api/stripe/webhooks/route.ts
 * @dependencies stripe
 */

import 'server-only'

import Stripe from 'stripe'

let _stripe: Stripe | null = null

/**
 * Returns the lazily-initialized Stripe SDK singleton.
 * @returns Stripe instance configured with the server-side secret key
 * @called-by lib/stripe/connect.ts, lib/stripe/transfer.ts, app/api/stripe/webhooks/route.ts
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
