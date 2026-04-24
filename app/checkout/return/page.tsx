/**
 * @file page.tsx
 * @description Server component hit by Stripe's `return_url` after embedded
 *   Checkout completes. Retrieves the Session, extracts the PaymentIntent,
 *   and redirects the user to their order:
 *     - Guest:  → /api/guest/verify-order?pi_id=... (that route sets the
 *               guest_order_token_{id} cookie and 302s to /order/{id})
 *     - Auth:   → /order/{id} after polling the webhook-written order row
 *
 *   Polls up to ~10s because the webhook (payment_intent.succeeded) can
 *   land after the return page renders.
 *   Called by: Stripe Checkout (return_url) — not directly by app code
 * @dependencies lib/stripe/client.ts, lib/supabase/server.ts, lib/supabase/service.ts
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getStripe } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const MAX_ATTEMPTS = 5
const RETRY_DELAY_MS = 1000

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id: sessionId } = await searchParams

  if (!sessionId) {
    return <ReturnError message="Missing session_id." />
  }

  let session
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId)
  } catch {
    return <ReturnError message="Could not load checkout session." />
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null

  if (!paymentIntentId) {
    return <ReturnError message="Payment is still processing. Please check your email for confirmation." />
  }

  const isGuest = session.metadata?.is_guest === 'true'

  if (isGuest) {
    // The guest verify-order endpoint already handles polling, cookie
    // setting, and the final redirect to /order/{id}.
    redirect(`/api/guest/verify-order?pi_id=${encodeURIComponent(paymentIntentId)}`)
  }

  // Authenticated flow: poll service-role DB for the webhook-written order.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // Session ended between checkout and return — send them to sign in; the
    // order is already safe in the DB under their prior auth id.
    redirect('/login')
  }

  const service = createServiceClient()
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: order } = await service
      .from('orders')
      .select('id, orderer_id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle()

    if (order) {
      if (order.orderer_id !== user.id) {
        // Extremely unlikely: PI belongs to a different account. Treat as
        // "still processing" from the user's perspective; don't leak the
        // mismatch.
        return <ReturnError message="Payment is still processing. Please check your email for confirmation." />
      }
      redirect(`/order/${order.id}`)
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }

  return <ReturnError message="Payment is still processing. You'll receive a notification when your order is ready." />
}

// --- Helpers ---

function ReturnError({ message }: { message: string }) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Almost there</h1>
      <p className="text-sm text-gray-600">{message}</p>
      <Link href="/" className="text-sm text-gray-500 underline hover:text-gray-700">
        Return home
      </Link>
    </main>
  )
}
