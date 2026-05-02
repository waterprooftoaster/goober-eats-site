/**
 * @file constants.ts
 * @description Application-wide constants (contact info, frozen-string helpers).
 *   Called by: various components and pages
 */

export const CONTACT_EMAIL = 'goobereats@gmail.com'

// --- Frozen strings (Session 01 baseline) ---
// Single declaration site for frontend-editable code. Authoritative values for
// bucket names, cookie prefixes, and content-type allowlists live in frozen
// paths (lib/api/guest-auth.ts, lib/types/api.ts, app/api/**); those are
// never re-declared in editable code.

export const PENDING_SCREENSHOTS_KEY = 'pending_screenshots'
export const PENDING_SCHOOL_ID_KEY = 'pending_school_id'
export const PENDING_SUBTOTAL_CENTS_KEY = 'pending_subtotal_cents'

// Cart-total bounds shared by the server-side extractor (lib/ai/extract-cart-total.ts)
// and the client-side prefill effect (app/checkout/page.tsx). Lives here so the
// client can import without dragging server-only modules into the browser bundle.
//   MIN: matches createCheckoutSchema.subtotal_cents.min(50) — Stripe's floor.
//   MAX: $1000 sanity ceiling; values above almost always indicate OCR
//        hallucination, so we drop them and let the user type.
export const CART_TOTAL_MIN_CENTS = 50
export const CART_TOTAL_MAX_CENTS = 100_000

/**
 * Supabase Realtime channel name for message INSERTs in a conversation.
 * @param conversationId - UUID of the conversation
 * @returns Channel name: `messages:<conversationId>`
 * @called-by hooks/use-messages.ts
 */
export function messagesChannel(conversationId: string): string {
  return `messages:${conversationId}`
}

/**
 * Supabase Realtime channel name for order status UPDATEs filtered to a given user.
 * @param userId - UUID of the orderer (auth or anonymous)
 * @returns Channel name: `orders:orderer:<userId>`
 * @called-by components/chat-panel/chat-panel-provider.tsx
 */
export function ordersOrdererChannel(userId: string): string {
  return `orders:orderer:${userId}`
}
