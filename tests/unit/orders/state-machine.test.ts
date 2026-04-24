/**
 * @file state-machine.test.ts
 * @description Unit tests for canTransition (graph predicate) and
 *   canComplete (payment dispute / status gate).
 *   Called by: Vitest
 */

import { describe, it, expect } from 'vitest'
import { canComplete, canTransition } from '@/lib/orders/state-machine'
import type { Payment } from '@/lib/types/database'

describe('canTransition', () => {
  it('open → in_progress is valid (swiper accepts)', () => {
    expect(canTransition('open', 'in_progress')).toBe(true)
  })

  it('open → cancelled is valid (orderer cancels)', () => {
    expect(canTransition('open', 'cancelled')).toBe(true)
  })

  it('in_progress → completed is valid', () => {
    expect(canTransition('in_progress', 'completed')).toBe(true)
  })

  it('in_progress → open is valid (swiper un-accepts)', () => {
    expect(canTransition('in_progress', 'open')).toBe(true)
  })

  it('open → completed is invalid', () => {
    expect(canTransition('open', 'completed')).toBe(false)
  })

  it('in_progress → cancelled is invalid', () => {
    expect(canTransition('in_progress', 'cancelled')).toBe(false)
  })

  it('completed → anything is invalid', () => {
    expect(canTransition('completed', 'open')).toBe(false)
    expect(canTransition('completed', 'in_progress')).toBe(false)
    expect(canTransition('completed', 'cancelled')).toBe(false)
  })

  it('cancelled → anything is invalid', () => {
    expect(canTransition('cancelled', 'open')).toBe(false)
    expect(canTransition('cancelled', 'in_progress')).toBe(false)
    expect(canTransition('cancelled', 'completed')).toBe(false)
  })
})

describe('canComplete', () => {
  const base: Payment = {
    id: 'pay-1',
    order_id: 'ord-1',
    stripe_payment_intent_id: 'pi_1',
    amount_cents: 1500,
    platform_fee_cents: 150,
    status: 'succeeded',
    payer_id: null,
    payee_id: null,
    created_at: new Date().toISOString(),
  }

  it('allows completion when payment is succeeded', () => {
    expect(canComplete(base)).toEqual({ ok: true })
  })

  it('blocks completion when payment is null (webhook not yet fired)', () => {
    const result = canComplete(null)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/not confirmed/i)
  })

  it('blocks completion when payment is disputed', () => {
    const result = canComplete({ ...base, status: 'disputed' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/disputed/i)
  })

  it('blocks completion when payment is pending', () => {
    const result = canComplete({ ...base, status: 'pending' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/not confirmed/i)
  })

  it('blocks completion when payment is refunded', () => {
    const result = canComplete({ ...base, status: 'refunded' })
    expect(result.ok).toBe(false)
  })
})
