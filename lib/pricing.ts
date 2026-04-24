/**
 * @file pricing.ts
 * @description Single source of truth for the Goober Eats platform-fee
 *   formula: a flat 10% of what the orderer pays. Used at checkout (sent to
 *   Stripe as `application_fee_amount` metadata), on payment creation
 *   (`payments.platform_fee_cents`), and at transfer time (deducted from
 *   the swiper payout).
 *   Called by: app/api/stripe/checkout-session/route.ts,
 *     app/api/stripe/webhooks/route.ts, lib/stripe/transfer.ts, scripts/seed.ts
 */

const PLATFORM_FEE_RATE = 0.10

/**
 * Computes the 10% platform fee (in cents) from an orderer total.
 * @param totalCents - Orderer-paid total, integer cents, >= 0
 * @returns Fee in cents, rounded half-away-from-zero
 * @called-by checkout-session/route.ts, webhooks/route.ts, transfer.ts, seed.ts
 */
export function platformFeeCents(totalCents: number): number {
  // Sub-cent drift is bounded at <1 cent per order — acceptable for a 10%
  // fee and avoids the complexity of carrying fractional cents in the DB.
  return Math.round(totalCents * PLATFORM_FEE_RATE)
}
