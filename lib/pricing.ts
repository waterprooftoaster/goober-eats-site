/**
 * @file pricing.ts
 * @description Pricing calculations for orderer payments and platform fee splits.
 *   Called by: app/api/stripe/checkout-session/route.ts, lib/stripe/transfer.ts, lib/cart/load.ts
 *
 * Pricing policy:
 *   User pays  50% of original_price_cents
 *   Platform   10% of original_price_cents (= 20% of user payment)
 *   Swiper     40% of original_price_cents (= user payment − platform fee)
 */

export function ordererPriceCents(originalCents: number): number {
  return Math.round(originalCents * 0.5)
}

export function platformFeeCents(itemsTotalCents: number): number {
  // itemsTotalCents is what the user pays (50% of original),
  // so 20% of that equals 10% of the original price.
  return Math.round(itemsTotalCents * 0.2)
}
