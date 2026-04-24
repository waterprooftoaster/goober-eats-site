/**
 * @file account-state.test.ts
 * @description Unit tests for the Stripe account-state mapper + predicates.
 *   Called by: Vitest
 */

import { describe, it, expect } from 'vitest'
import type Stripe from 'stripe'
import {
  canAccept,
  fromStripeAccount,
  humanReason,
  type AccountState,
} from '@/lib/stripe/account-state'

function mkAccount(overrides: Partial<Stripe.Account> = {}): Stripe.Account {
  return {
    id: 'acct_test',
    object: 'account',
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
    requirements: {
      disabled_reason: null,
      currently_due: [],
      past_due: [],
      eventually_due: [],
      pending_verification: [],
      errors: [],
      current_deadline: null,
      alternatives: [],
      disabled_until: null,
    },
    ...overrides,
  } as unknown as Stripe.Account
}

describe('fromStripeAccount', () => {
  it('marks onboarding complete when details submitted AND charges enabled', () => {
    const state = fromStripeAccount(
      mkAccount({ details_submitted: true, charges_enabled: true })
    )
    expect(state.onboardingComplete).toBe(true)
    expect(state.chargesEnabled).toBe(true)
    expect(state.payoutsEnabled).toBe(true)
    expect(state.disabledReason).toBeNull()
    expect(state.currentlyDue).toEqual([])
  })

  it('downgrades onboarding when charges_enabled becomes false', () => {
    const state = fromStripeAccount(
      mkAccount({ details_submitted: true, charges_enabled: false })
    )
    expect(state.onboardingComplete).toBe(false)
    expect(state.chargesEnabled).toBe(false)
  })

  it('captures disabled_reason from requirements', () => {
    const state = fromStripeAccount(
      mkAccount({
        charges_enabled: false,
        requirements: {
          disabled_reason: 'requirements.past_due',
          currently_due: ['individual.dob.day'],
        } as unknown as Stripe.Account.Requirements,
      })
    )
    expect(state.disabledReason).toBe('requirements.past_due')
    expect(state.currentlyDue).toEqual(['individual.dob.day'])
  })
})

describe('canAccept', () => {
  const healthy: AccountState = {
    onboardingComplete: true,
    chargesEnabled: true,
    payoutsEnabled: true,
    disabledReason: null,
    currentlyDue: [],
  }

  it('returns true for a fully healthy account', () => {
    expect(canAccept(healthy)).toBe(true)
  })

  it('rejects when charges disabled', () => {
    expect(canAccept({ ...healthy, chargesEnabled: false })).toBe(false)
  })

  it('rejects when payouts disabled', () => {
    expect(canAccept({ ...healthy, payoutsEnabled: false })).toBe(false)
  })

  it('rejects when onboarding incomplete', () => {
    expect(canAccept({ ...healthy, onboardingComplete: false })).toBe(false)
  })

  it('rejects when disabled_reason is set (even if flags look healthy)', () => {
    expect(canAccept({ ...healthy, disabledReason: 'requirements.past_due' })).toBe(false)
  })

  it('rejects when requirements are currently_due', () => {
    expect(canAccept({ ...healthy, currentlyDue: ['individual.dob.day'] })).toBe(false)
  })
})

describe('humanReason', () => {
  it('returns null for null/undefined/empty', () => {
    expect(humanReason(null)).toBeNull()
    expect(humanReason(undefined)).toBeNull()
    expect(humanReason('')).toBeNull()
  })

  it('maps known Stripe codes to English sentences', () => {
    expect(humanReason('requirements.past_due')).toContain('additional information')
    expect(humanReason('rejected.fraud')).toContain('rejected')
    expect(humanReason('under_review')).toContain('under review')
  })

  it('falls back to a generic sentence for unknown codes', () => {
    const text = humanReason('something.brand.new')
    expect(text).not.toContain('something.brand.new')
    expect(text).toContain('payment account')
  })
})
