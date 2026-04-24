/**
 * @file pricing.test.ts
 * @description Unit tests for the single-source-of-truth platform fee helper.
 *   Called by: Vitest
 */

import { describe, it, expect } from 'vitest'
import { platformFeeCents } from '@/lib/pricing'

describe('platformFeeCents', () => {
  it('returns 10% of total (whole numbers)', () => {
    expect(platformFeeCents(1000)).toBe(100)
    expect(platformFeeCents(5000)).toBe(500)
    expect(platformFeeCents(12_300)).toBe(1230)
  })

  it('rounds half to nearest cent', () => {
    // 455 * 0.10 = 45.5 → rounds to 46 (round half away from zero)
    expect(platformFeeCents(455)).toBe(46)
    // 454 * 0.10 = 45.4 → rounds to 45
    expect(platformFeeCents(454)).toBe(45)
  })

  it('returns 0 for a zero-cost total', () => {
    expect(platformFeeCents(0)).toBe(0)
  })

  it('handles the min Stripe checkout amount (50 cents)', () => {
    // 50 * 0.10 = 5 → 5 cents fee
    expect(platformFeeCents(50)).toBe(5)
  })

  it('handles the max checkout total (50000 cents = $500)', () => {
    expect(platformFeeCents(50_000)).toBe(5_000)
  })
})
