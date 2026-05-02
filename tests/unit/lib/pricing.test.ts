/**
 * @file pricing.test.ts
 * @description Unit tests for lib/pricing.ts:computeSplit. Locks in the
 *   40/30/10 policy (orderer pays 40%, swiper 30%, platform 10%, discount
 *   60%) and the self-consistency invariant orderer = platform + swiper.
 */

import { describe, it, expect } from 'vitest'
import { computeSplit } from '@/lib/pricing'

describe('computeSplit', () => {
  it('splits a $100 subtotal into 40/10/30 cents-of-original', () => {
    expect(computeSplit(10_000)).toEqual({
      subtotalCents: 10_000,
      ordererPaysCents: 4_000,
      platformFeeCents: 1_000,
      swiperReceivesCents: 3_000,
    })
  })

  it('splits a $25 subtotal into $10 / $2.50 / $7.50', () => {
    expect(computeSplit(2_500)).toEqual({
      subtotalCents: 2_500,
      ordererPaysCents: 1_000,
      platformFeeCents: 250,
      swiperReceivesCents: 750,
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
    expect(split.ordererPaysCents).toBe(20)
    expect(split.platformFeeCents).toBe(5)
    expect(split.swiperReceivesCents).toBe(15)
  })
})
