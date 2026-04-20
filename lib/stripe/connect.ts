/**
 * @file connect.ts
 * @description Stripe Connect helpers: creates express accounts, onboarding links, and dashboard login links.
 *   Called by: app/api/stripe/connect/route.ts, app/api/stripe/connect/dashboard/route.ts
 * @dependencies lib/stripe/client.ts
 */

import 'server-only'

import { getStripe } from './client'

/**
 * Creates a Stripe Express connected account for a swiper with US card/transfer capabilities.
 * @param userId - Supabase user ID stored in Stripe metadata for cross-referencing
 * @param email - Swiper's email pre-filled on the Stripe onboarding form
 * @returns Stripe Account object
 * @called-by app/api/stripe/connect/route.ts
 */
export async function createExpressAccount(userId: string, email: string) {
  return await getStripe().accounts.create({
    country: 'US',
    email: email,
    business_type: 'individual',
    business_profile: {
      mcc: '7372',
      url: 'https://goobereats.net',
      product_description: "Peer-to-peer student meal swipe sharing app"
    },
    controller: {
      fees: {
        payer: 'application',
      },
      losses: {
        payments: 'application',
      },
      stripe_dashboard: {
        type: 'express',
      },
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    settings: {
      payments: {
        statement_descriptor: "WWW.GOOBEREATS.NET"
      }
    },
    metadata: { user_id: userId },
  });
}

/**
 * Creates a Stripe account onboarding link for a swiper to complete KYC.
 * @param stripeAccountId - The swiper's Stripe connected account ID
 * @param returnUrl - URL Stripe redirects to after successful onboarding
 * @param refreshUrl - URL Stripe redirects to if the link expires
 * @returns AccountLink with a one-time URL for the onboarding flow
 * @called-by app/api/stripe/connect/onboard/route.ts
 */
export async function createOnboardingLink(
  stripeAccountId: string,
  returnUrl: string,
  refreshUrl: string
) {
  return getStripe().accountLinks.create({
    account: stripeAccountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: 'account_onboarding',
  })
}

export async function createLoginLink(stripeAccountId: string) {
  return getStripe().accounts.createLoginLink(stripeAccountId)
}
