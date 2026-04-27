/**
 * @file page.tsx
 * @description Stripe Embedded Checkout return handler. Receives the
 *   Checkout `session_id` from Stripe, retrieves the session to read the
 *   PaymentIntent ID + guest metadata, then `redirect()`s downstream:
 *   guests → /api/guest/verify-order (cookie + redirect home);
 *   authed users → /current-orders.
 *
 *   Pure server redirect — never renders DOM in the happy path.
 *   Called by: Stripe `return_url` redirect after successful payment
 * @dependencies lib/stripe/client.ts
 */

import { redirect } from 'next/navigation'
import { getStripe } from '@/lib/stripe/client'

interface Props {
  searchParams: Promise<{ session_id?: string }>
}

/**
 * Resolves the Stripe Checkout session and routes the user to the right
 * downstream surface. Authed users land on /current-orders so the realtime
 * order they just paid for is visible immediately (catalog
 * ORD-CHECKOUT-RETURN-AUTHED).
 * @param searchParams - URL search params containing `session_id` from Stripe
 * @called-by Stripe return_url redirect
 */
export default async function CheckoutReturnPage({ searchParams }: Props) {
  const { session_id } = await searchParams
  // Stripe Checkout session IDs are `cs_test_…` / `cs_live_…` followed by
  // alphanumerics + underscores. Validate the shape before issuing the SDK
  // call so attacker-controlled query strings don't end up in Stripe's API
  // error logs or our application monitoring.
  if (!session_id || !/^cs_[a-zA-Z0-9_]+$/.test(session_id)) redirect('/')

  let session
  try {
    session = await getStripe().checkout.sessions.retrieve(session_id)
  } catch {
    redirect('/')
  }

  const piId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id

  if (!piId) redirect('/')

  if (session.metadata?.is_guest === 'true') {
    redirect(`/api/guest/verify-order?pi_id=${piId}`)
  }

  redirect('/current-orders')
}
