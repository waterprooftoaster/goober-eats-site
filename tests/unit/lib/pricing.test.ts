/**
 * @file pricing.test.ts
 * @description Unit tests for lib/pricing.ts:computeSplit. Locks in the
 *   60/50/10 policy (orderer pays 60%, swiper 50%, platform 10%, discount
 *   40%) and the self-consistency invariant orderer = platform + swiper.
 */

import { describe, it, expect } from 'vitest'
import { computeSplit } from '@/lib/pricing'

describe('computeSplit', () => {
  it('splits a $100 subtotal into 60/10/50 cents-of-original', () => {
    expect(computeSplit(10_000)).toEqual({
      subtotalCents: 10_000,
      ordererPaysCents: 6_000,
      platformFeeCents: 1_000,
      swiperReceivesCents: 5_000,
    })
  })

  it('splits a $25 subtotal into $15 / $2.50 / $12.50', () => {
    expect(computeSplit(2_500)).toEqual({
      subtotalCents: 2_500,
      ordererPaysCents: 1_500,
      platformFeeCents: 250,
      swiperReceivesCents: 1_250,
    })
  })

  it('preserves the invariant orderer = platform + swiper for odd subtotals', () => {
    for (const subtotal of [50, 51, 99, 137, 999, 1001, 12_345, 49_999]) {
      const split = computeSplit(subtotal)
      expect(split.platformFeeCents + split.swiperReceivesCents).toBe(
        split.ordererPaysCents
      )
    }
  })

  it('handles the Stripe minimum subtotal (50¢)', () => {
    const split = computeSplit(50)
    expect(split.ordererPaysCents).toBe(30)
    expect(split.platformFeeCents).toBe(5)
    expect(split.swiperReceivesCents).toBe(25)
  })
})
