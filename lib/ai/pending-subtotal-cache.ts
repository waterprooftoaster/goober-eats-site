/**
 * @file pending-subtotal-cache.ts
 * @description Module-level cache for the in-flight Gemini auto-pricing fetch
 *   that's kicked off on the home page after the screenshot uploads. The
 *   /checkout page reads this on mount to seed the Cart Total input.
 *
 *   Lifecycle:
 *     1. home-upload calls setPendingSubtotalCents(promise) right before
 *        router.push('/checkout'). Stale sessionStorage gets cleared so
 *        back→re-upload→checkout doesn't read a previous value.
 *     2. The promise's resolve hook writes PENDING_SUBTOTAL_CENTS_KEY to
 *        sessionStorage (when cents !== null), so a /checkout reload after
 *        the fetch resolved still hits a populated input.
 *     3. /checkout calls getPendingSubtotalCentsPromise() if the
 *        sessionStorage key is absent. Awaits with an 8s timeout; late
 *        resolves still update the input via the dirty guard in the page.
 *     4. Submit success calls clearPendingSubtotalCents() alongside the
 *        existing PENDING_SCREENSHOTS_KEY removal.
 *   Called by: components/home-upload.tsx, app/checkout/page.tsx
 * @dependencies lib/constants.ts
 */

import 'client-only'
import { PENDING_SUBTOTAL_CENTS_KEY } from '@/lib/constants'

let pending: Promise<number | null> | null = null

/**
 * Stores an in-flight cents-extraction promise. Clears any stale
 * sessionStorage key first; on resolve, writes the cents value to
 * sessionStorage so reload-after-resolve hits the populated input.
 * @param promise - Resolves with integer cents (or null on extraction
 *   failure). Errors are swallowed and treated as null.
 * @called-by components/home-upload.tsx (handlePlaceOrder)
 */
export function setPendingSubtotalCents(promise: Promise<number | null>): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(PENDING_SUBTOTAL_CENTS_KEY)
  }

  const safe = promise.catch(() => null)
  pending = safe

  void safe.then((cents) => {
    if (cents !== null && typeof window !== 'undefined') {
      sessionStorage.setItem(PENDING_SUBTOTAL_CENTS_KEY, String(cents))
    }
  })
}

/**
 * Returns the in-flight cents-extraction promise, or null if no fetch was
 * registered before this module instance loaded (e.g. hard reload of /checkout).
 * @returns The pending Promise, or null
 * @called-by app/checkout/page.tsx
 */
export function getPendingSubtotalCentsPromise(): Promise<number | null> | null {
  return pending
}

/**
 * Clears the in-flight promise and the sessionStorage key. Called after the
 * Stripe checkout session is created so a back-navigation to /checkout
 * doesn't reuse a value that no longer matches the (already-paid) order.
 * @called-by app/checkout/page.tsx (handleSubmit success path)
 */
export function clearPendingSubtotalCents(): void {
  pending = null
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(PENDING_SUBTOTAL_CENTS_KEY)
  }
}
