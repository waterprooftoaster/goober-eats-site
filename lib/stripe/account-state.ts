/**
 * @file account-state.ts
 * @description Maps a Stripe Connect account into the denormalized state the
 *   app stores in `stripe_accounts`. Used by three consumers — the
 *   account.updated webhook handler, the accept-eligibility gate in
 *   /api/orders/[id]/accept, and the swiper-section UI — so the extraction
 *   beats inlining per the CLAUDE.md 3+-callers rule. Also exports a
 *   plain-English mapper for Stripe's `disabled_reason` codes.
 *   Called by: app/api/stripe/webhooks/route.ts,
 *     app/api/orders/[id]/accept/route.ts, app/account/swiper-section.tsx
 * @dependencies stripe (types only)
 */

import type Stripe from 'stripe'

export interface AccountState {
  /** True when Stripe has accepted all required info for the account. */
  onboardingComplete: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  /** Stripe-provided reason when the account is disabled, or null. */
  disabledReason: string | null
  /** Requirements currently due (empty when the account is healthy). */
  currentlyDue: string[]
}

/**
 * Flattens a Stripe.Account into the denormalized shape stored in stripe_accounts.
 * @param account - The Stripe account object from `accounts.retrieve` or `account.updated` webhook
 * @returns AccountState — mirrors the stripe_accounts columns added in migration 20260423000000
 * @called-by handleAccountUpdated in webhooks/route.ts
 */
export function fromStripeAccount(account: Stripe.Account): AccountState {
  // onboarding_complete was historically driven by
  // `details_submitted && charges_enabled`. Now we track both independently
  // and derive the boolean. charges_enabled alone is what actually blocks
  // transfers, so tie it to that signal; details_submitted without
  // charges_enabled means Stripe is still underwriting.
  const chargesEnabled = account.charges_enabled === true
  const payoutsEnabled = account.payouts_enabled === true

  return {
    onboardingComplete:
      account.details_submitted === true && chargesEnabled,
    chargesEnabled,
    payoutsEnabled,
    disabledReason: account.requirements?.disabled_reason ?? null,
    currentlyDue: account.requirements?.currently_due ?? [],
  }
}

/**
 * Predicate: can this swiper accept orders right now?
 * @param state - AccountState (either fresh from Stripe or read from stripe_accounts)
 * @returns true only if onboarding is complete, charges and payouts are live,
 *   and Stripe has no disabled_reason or outstanding requirements
 * @called-by accept/route.ts, swiper-section.tsx
 */
export function canAccept(state: AccountState): boolean {
  return (
    state.onboardingComplete &&
    state.chargesEnabled &&
    state.payoutsEnabled &&
    state.disabledReason === null &&
    state.currentlyDue.length === 0
  )
}

/**
 * Translates a Stripe `disabled_reason` code into a short, user-visible sentence.
 * @param code - The value from `stripe_accounts.disabled_reason`, or null
 * @returns A plain-English explanation, or null when there's nothing to surface
 * @called-by accept/route.ts (error payload), swiper-section.tsx (pending-pill tooltip)
 */
export function humanReason(code: string | null | undefined): string | null {
  if (!code) return null

  // Codes are Stripe-stable strings. This table is not exhaustive — any
  // unknown code falls through to a generic sentence so we never render a
  // raw Stripe identifier to the swiper.
  const map: Record<string, string> = {
    'requirements.past_due':
      'Stripe needs additional information to re-enable your payment account.',
    'requirements.pending_verification':
      'Stripe is reviewing the information you submitted. This usually takes a few minutes.',
    'listed':
      'Your account is on a restricted list. Reply to Stripe\'s email or contact support to continue.',
    'platform_paused':
      'The Goober Eats platform has paused your account. Contact support.',
    'rejected.fraud':
      'Your account was rejected during review. Contact Stripe support.',
    'rejected.incomplete_verification':
      'Your account was rejected because verification is incomplete.',
    'rejected.listed':
      'Your account was rejected because it was on a restricted list.',
    'rejected.other':
      'Your account was rejected. Contact Stripe support for details.',
    'rejected.terms_of_service':
      'Your account was rejected for a terms-of-service violation.',
    'under_review':
      'Your account is under review. Most reviews finish within a few business days.',
    'other':
      'There\'s an issue with your payment account. Click "Complete Payment Setup" to fix it.',
  }

  return (
    map[code] ??
    'There\'s an issue with your payment account. Click "Complete Payment Setup" to review it in Stripe.'
  )
}
