/**
 * @file checkout-form.test.ts
 * @description Unit tests for the dollars-to-cents conversion used in the checkout page.
 *   Called by: Vitest test runner
 */

import { describe, it, expect } from 'vitest'

// Mirrors the parseCents helper in app/checkout/page.tsx.
function parseCents(value: string): number | null {
  const n = parseFloat(value)
  if (isNaN(n) || n <= 0) return null
  return Math.round(n * 100)
}

describe('parseCents', () => {
  it('converts a whole dollar amount', () => {
    expect(parseCents('5')).toBe(500)
  })

  it('converts the Stripe minimum ($0.50)', () => {
    expect(parseCents('0.50')).toBe(50)
  })

  it('converts $9.99', () => {
    expect(parseCents('9.99')).toBe(999)
  })

  it('converts a typical order total ($12.99)', () => {
    expect(parseCents('12.99')).toBe(1299)
  })

  it('converts $499.99', () => {
    expect(parseCents('499.99')).toBe(49999)
  })

  it('returns null for empty string', () => {
    expect(parseCents('')).toBeNull()
  })

  it('returns null for non-numeric input', () => {
    expect(parseCents('abc')).toBeNull()
  })

  it('returns null for zero', () => {
    expect(parseCents('0')).toBeNull()
  })

  it('returns null for negative value', () => {
    expect(parseCents('-1')).toBeNull()
  })
})
