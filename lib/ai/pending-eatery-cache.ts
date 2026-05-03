/**
 * @file pending-eatery-cache.ts
 * @description Module-level cache for the in-flight Gemini eatery-name fetch
 *   kicked off on the home page after screenshot upload. The /checkout page
 *   reads this on mount to seed the Campus Eatery Name input. Mirrors the
 *   lifecycle of pending-subtotal-cache.ts.
 *   Called by: components/home-upload.tsx, app/checkout/page.tsx
 * @dependencies lib/constants.ts
 */

import 'client-only'
import { PENDING_EATERY_NAME_KEY } from '@/lib/constants'

let pending: Promise<string | null> | null = null

/**
 * Stores an in-flight eatery-name promise. Clears stale sessionStorage first;
 * on resolve, writes the name to sessionStorage for reload-after-resolve.
 * @param promise - Resolves with an eatery name string or null.
 * @called-by components/home-upload.tsx (handlePlaceOrder)
 */
export function setPendingEateryName(promise: Promise<string | null>): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(PENDING_EATERY_NAME_KEY)
  }

  const safe = promise.catch(() => null)
  pending = safe

  void safe.then((name) => {
    if (name !== null && typeof window !== 'undefined') {
      sessionStorage.setItem(PENDING_EATERY_NAME_KEY, name)
    }
  })
}

/**
 * Returns the in-flight eatery-name promise, or null if none was registered.
 * @returns The pending Promise, or null
 * @called-by app/checkout/page.tsx
 */
export function getPendingEateryNamePromise(): Promise<string | null> | null {
  return pending
}

/**
 * Clears the in-flight promise and sessionStorage key after checkout submit.
 * @called-by app/checkout/page.tsx (handleSubmit success path)
 */
export function clearPendingEateryName(): void {
  pending = null
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(PENDING_EATERY_NAME_KEY)
  }
}
