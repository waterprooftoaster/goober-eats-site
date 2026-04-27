/**
 * @file pricing.ts
 * @description Single source of truth for the orderer/swiper/platform money
 *   split. Given the GrubHub subtotal the orderer enters at checkout, derives
 *   what the orderer pays (Stripe charge), what the platform keeps, and what
 *   the swiper receives on completion (Stripe transfer).
 *   Called by: app/api/stripe/checkout-session/route.ts,
 *              app/api/stripe/webhooks/route.ts, scripts/seed.ts
 *
 * Pricing policy (share of subtotal):
 *   Discount       40%
 *   Orderer pays   60%   ← Stripe charge amount
 *   Platform fee   10%   ← retained on platform balance
 *   Swiper         50%   ← Stripe transfer on completion
 *
 * Self-consistency: ordererPaysCents = platformFeeCents + swiperReceivesCents
 * is enforced by deriving swiperReceivesCents as the difference rather than a
 * separate Math.round, so sub-cent rounding can never leave the platform short
 * or over-pay the swiper.
 */

export interface PriceSplit {
  subtotalCents: number
  ordererPaysCents: number
  platformFeeCents: number
  swiperReceivesCents: number
}

/**
 * Computes the full money split from the GrubHub subtotal.
 * @param subtotalCents - Integer subtotal in cents (orderer-entered)
 * @returns PriceSplit with charge, fee, and transfer amounts in cents
 * @called-by app/api/stripe/checkout-session/route.ts, app/api/stripe/webhooks/route.ts
 */
export function computeSplit(subtotalCents: number): PriceSplit {
  const ordererPaysCents = Math.round(subtotalCents * 0.6)
  const platformFeeCents = Math.round(subtotalCents * 0.1)
  // Derive (don't re-round) so charge == fee + transfer exactly.
  const swiperReceivesCents = ordererPaysCents - platformFeeCents
  return { subtotalCents, ordererPaysCents, platformFeeCents, swiperReceivesCents }
}
