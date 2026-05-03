/**
 * @file stripe-seed.ts
 * @description Creates real Stripe Connect Express accounts for seeded swipers using
 *   test-mode magic values, so transfers from `lib/stripe/transfer.ts` succeed against
 *   seeded data. Idempotent (looks up existing accounts by metadata.user_id +
 *   metadata.seeded). Test-only — guarded against live STRIPE_SECRET_KEY.
 *   Called by: scripts/seed.ts
 * @dependencies lib/stripe/sdk.ts
 */

import type Stripe from 'stripe'
import { getStripe } from '../../lib/stripe/sdk'

/**
 * Asserts STRIPE_SECRET_KEY is present and a sandbox key (sk_test_…). Throws otherwise.
 * @called-by scripts/seed.ts:main
 */
export function assertStripeTestMode(): void {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error(
      'Refusing to seed: STRIPE_SECRET_KEY is not set. Export an sk_test_ key or pass SEED_SKIP_STRIPE=1.'
    )
  }
  if (!key.startsWith('sk_test_')) {
    throw new Error(
      'Refusing to seed: STRIPE_SECRET_KEY is not a test key (must start with sk_test_).'
    )
  }
}

/**
 * Returns a real Stripe Connect Express account ID for a seeded swiper. Reuses any
 * existing account whose `metadata.user_id` matches and `metadata.seeded === 'true'`;
 * otherwise creates a fresh account (mirroring `lib/stripe/connect.ts:createExpressAccount`)
 * and immediately updates it with Stripe's documented test magic values to satisfy every
 * onboarding requirement and unlock the transfers capability synchronously.
 * @param userId - Supabase user UUID (stored in metadata for idempotency)
 * @param email - Swiper email (stored on the account; pre-fills onboarding form)
 * @returns Stripe account ID (e.g. acct_1Q…)
 * @called-by scripts/seed.ts:seedStripeAccounts
 */
export async function getOrCreateSeededStripeAccount(
  userId: string,
  email: string
): Promise<string> {
  const existing = await findSeededAccount(userId)
  if (existing) {
    // Only re-apply magic values when transfers haven't activated yet — otherwise
    // we re-stamp tos_acceptance.date on every seed run for no reason.
    if (existing.capabilities?.transfers !== 'active') {
      await applyTestMagicValues(existing.id, email)
      await warnIfTransfersInactive(existing.id)
    }
    return existing.id
  }

  const created = await getStripe().accounts.create({
    country: 'US',
    email,
    business_type: 'individual',
    business_profile: {
      mcc: '7372',
      url: 'https://goobereats.net',
      product_description: 'Peer-to-peer student meal swipe sharing app',
    },
    controller: {
      fees: { payer: 'application' },
      losses: { payments: 'application' },
      // App-controlled requirement collection requires dashboard type 'none'
      // (Stripe rejects 'express' + requirement_collection: 'application').
      // Platform owns onboarding; applyTestMagicValues sets the TOS + identity.
      stripe_dashboard: { type: 'none' },
      requirement_collection: 'application',
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    settings: {
      payments: { statement_descriptor: 'WWW.GOOBEREATS.NET' },
    },
    metadata: { user_id: userId, seeded: 'true' },
  })

  await applyTestMagicValues(created.id, email)
  await warnIfTransfersInactive(created.id)
  return created.id
}

// --- Helpers ---

/**
 * Pages through Stripe accounts to find one previously created by this seed script
 * for the given user. `accounts.list` has no metadata filter, so this is an O(n)
 * scan over every connected account in the test environment — fine for fresh test
 * environments but seed runs slow down as the test account accumulates Connects.
 * @param userId - Supabase user UUID to match against `metadata.user_id`
 * @returns The matching Stripe account, or null if none exist
 * @called-by getOrCreateSeededStripeAccount
 */
async function findSeededAccount(userId: string): Promise<Stripe.Account | null> {
  for await (const account of getStripe().accounts.list({ limit: 100 })) {
    if (
      account.metadata?.user_id === userId &&
      account.metadata?.seeded === 'true'
    ) {
      return account
    }
  }
  return null
}

/**
 * Applies Stripe's documented test magic values so every requirement is satisfied and
 * the transfers capability flips to `active` synchronously. See
 * https://docs.stripe.com/connect/testing.
 * @param accountId - The Stripe account ID to update
 * @param email - Swiper email used on the individual record
 * @called-by getOrCreateSeededStripeAccount
 */
async function applyTestMagicValues(accountId: string, email: string): Promise<void> {
  await getStripe().accounts.update(accountId, {
    business_profile: {
      mcc: '7372',
      url: 'https://goobereats.net',
    },
    individual: {
      first_name: 'Test',
      last_name: 'Swiper',
      email,
      phone: '+15555555555',
      dob: { day: 1, month: 1, year: 1901 },
      address: {
        line1: 'address_full_match',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'US',
      },
      ssn_last_4: '0000',
      id_number: '000000000',
    },
    tos_acceptance: {
      date: Math.floor(Date.now() / 1000),
      ip: '127.0.0.1',
    },
    external_account: 'btok_us_verified',
  })
}

/**
 * Logs a warning if the transfers capability hasn't reached `active`. Intentionally
 * non-throwing — Stripe occasionally needs a second pass to flip the capability, and
 * a re-run of the seed will pick it up.
 * @param accountId - The Stripe account ID to inspect
 * @called-by getOrCreateSeededStripeAccount
 */
async function warnIfTransfersInactive(accountId: string): Promise<void> {
  const account = await getStripe().accounts.retrieve(accountId)
  const transfers = account.capabilities?.transfers
  if (transfers !== 'active') {
    console.warn(
      `Stripe account ${accountId} transfers capability is "${transfers}" (expected "active"). Re-run the seed if transfers continue to fail.`
    )
  }
}
