/**
 * @file complaint-eligibility.test.ts
 * @description Unit tests for lib/orders/complaint-eligibility.ts. Covers the
 *   24-hour window boundary in both directions plus null/invalid inputs.
 *   Called by: vitest
 */

import { describe, it, expect } from 'vitest'
import { isWithinComplaintWindow, COMPLAINT_WINDOW_MS } from '@/lib/orders/complaint-eligibility'

describe('isWithinComplaintWindow', () => {
  const now = new Date('2026-04-30T12:00:00.000Z')

  it('returns true when completedAt is now', () => {
    expect(isWithinComplaintWindow(now.toISOString(), now)).toBe(true)
  })

  it('returns true at 23h59m59s after completion', () => {
    const completedAt = new Date(now.getTime() - (COMPLAINT_WINDOW_MS - 1_000))
    expect(isWithinComplaintWindow(completedAt.toISOString(), now)).toBe(true)
  })

  it('returns false at exactly 24h after completion', () => {
    const completedAt = new Date(now.getTime() - COMPLAINT_WINDOW_MS)
    expect(isWithinComplaintWindow(completedAt.toISOString(), now)).toBe(false)
  })

  it('returns false at 24h01m after completion', () => {
    const completedAt = new Date(now.getTime() - (COMPLAINT_WINDOW_MS + 60_000))
    expect(isWithinComplaintWindow(completedAt.toISOString(), now)).toBe(false)
  })

  it('returns false when completedAt is null', () => {
    expect(isWithinComplaintWindow(null, now)).toBe(false)
  })

  it('returns false when completedAt is in the future (clock skew safety)', () => {
    const future = new Date(now.getTime() + 60_000)
    expect(isWithinComplaintWindow(future.toISOString(), now)).toBe(false)
  })

  it('returns false for an unparseable timestamp', () => {
    expect(isWithinComplaintWindow('not-a-date', now)).toBe(false)
  })

  it('accepts a Date instance for completedAt', () => {
    const completedAt = new Date(now.getTime() - 60_000)
    expect(isWithinComplaintWindow(completedAt, now)).toBe(true)
  })

  it('defaults `now` to the current time when omitted', () => {
    const recent = new Date(Date.now() - 60_000).toISOString()
    expect(isWithinComplaintWindow(recent)).toBe(true)
  })
})
