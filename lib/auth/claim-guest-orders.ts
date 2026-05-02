'use server'

/**
 * @file claim-guest-orders.ts
 * @description Server-only helper that walks the caller's
 *   `guest_order_token_{orderId}` cookies and rebinds matching orders to a
 *   newly-authenticated user (orderer_id = userId). Required because the
 *   `orders_update` RLS policy only matches when auth.uid() already equals
 *   orderer_id or swiper_id; the NULL→user transition needs the service
 *   client. Idempotent + race-safe via `.is('orderer_id', null)`. Mirrors
 *   the conversation row's orderer_id so the user passes the
 *   `Users can view their conversations` policy.
 *   Called by: app/auth/actions.ts (authenticate sign-in branch, completeOnboarding)
 * @dependencies lib/supabase/service.ts
 */

import 'server-only'

import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'
import { guestOrderCookieName } from '@/lib/api/guest-auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const COOKIE_PREFIX_RE = /^guest_order_token_(.+)$/

interface ClaimResult {
  claimedOrderIds: string[]
}

/**
 * Reads all guest_order_token_* cookies, validates each token against
 * `orders.guest_access_token`, and atomically rebinds matching orders to the
 * given userId via the service client. Returns the list of claimed order ids
 * so the caller can clear the cookies.
 * @param userId - Authenticated user's id (auth.uid()) to set as orderer_id
 * @returns { claimedOrderIds }
 * @called-by app/auth/actions.ts (post-signIn / post-onboarding)
 */
export async function claimGuestOrders(userId: string): Promise<ClaimResult> {
  if (!UUID_RE.test(userId)) {
    // Defensive: caller is server-side and should always pass a valid uid,
    // but fail closed rather than issue a service-client write with garbage.
    return { claimedOrderIds: [] }
  }

  const cookieStore = await cookies()
  const all = cookieStore.getAll()
  const candidates: { orderId: string; token: string }[] = []
  for (const c of all) {
    const m = COOKIE_PREFIX_RE.exec(c.name)
    if (!m) continue
    const orderId = m[1]
    if (!UUID_RE.test(orderId)) continue
    if (!c.value) continue
    // Token is also a UUID in the schema — reject malformed values up front
    // so we never feed garbage into the eventual DB comparison.
    if (!UUID_RE.test(c.value)) continue
    candidates.push({ orderId, token: c.value })
  }
  if (candidates.length === 0) {
    return { claimedOrderIds: [] }
  }

  const supabase = createServiceClient()
  // .is('orderer_id', null) — idempotent + race-safe: if a concurrent flow
  // (or a partial earlier claim) has already set orderer_id, the row drops
  // out of the SELECT and we don't double-claim.
  const { data: rows, error: selectError } = await supabase
    .from('orders')
    .select('id, guest_access_token, orderer_id')
    .in(
      'id',
      candidates.map((c) => c.orderId)
    )
    .is('orderer_id', null)

  if (selectError) {
    console.error('claimGuestOrders: select failed', selectError)
    return { claimedOrderIds: [] }
  }

  const tokenByOrderId = new Map(candidates.map((c) => [c.orderId, c.token]))
  const matched = (rows ?? []).filter(
    (r): r is { id: string; guest_access_token: string; orderer_id: null } =>
      r.guest_access_token !== null && r.guest_access_token === tokenByOrderId.get(r.id)
  )
  if (matched.length === 0) {
    return { claimedOrderIds: [] }
  }

  // Update conversations FIRST (additive: just sets orderer_id), then orders
  // (destructive: clears guest_access_token and anon_user_id). Order matters:
  // if the conversation update fails first, we abort before touching the
  // order, so all guest access paths remain intact and the next sign-in can
  // retry. If the order update fails after the conversation succeeded, the
  // conversation orderer_id is harmlessly mirrored to the eventual claimer
  // (idempotent — re-running with the same userId is a no-op semantically).
  const updates = await Promise.all(
    matched.map(async (row) => {
      const { error: convError } = await supabase
        .from('conversations')
        .update({ orderer_id: userId })
        .eq('order_id', row.id)
      if (convError) {
        console.error('claimGuestOrders: conversation update failed', {
          orderId: row.id,
          convError,
        })
        return null
      }
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          orderer_id: userId,
          guest_access_token: null,
          anon_user_id: null,
        })
        .eq('id', row.id)
        .is('orderer_id', null)
      if (orderError) {
        console.error('claimGuestOrders: order update failed', { orderId: row.id, orderError })
        return null
      }
      return row.id
    })
  )
  return { claimedOrderIds: updates.filter((id): id is string => id !== null) }
}

/**
 * Clears the guest_order_token_{orderId} cookies for each claimed order id.
 * Must be called from a Server Action / Route Handler context where the
 * Next.js cookies() store is mutable.
 * @param orderIds - Order ids whose cookies should be cleared
 * @called-by app/auth/actions.ts (post-claim)
 */
export async function clearGuestOrderCookies(orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return
  const cookieStore = await cookies()
  for (const id of orderIds) {
    cookieStore.set(guestOrderCookieName(id), '', { maxAge: 0, path: '/' })
  }
}
