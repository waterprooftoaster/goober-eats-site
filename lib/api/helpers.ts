/**
 * @file helpers.ts
 * @description Shared API utilities: response helpers, authenticated user lookup, and cart session management.
 *   Called by: all app/api/ route handlers
 * @dependencies next/server, @supabase/supabase-js
 */

import { NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import { randomUUID } from 'crypto'

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

/**
 * Resolves the authenticated Supabase user from the cookie session — cheap path.
 * @returns the User on success; null when there is no session or auth fails
 * @called-by every authed API route + page that doesn't need swiper-specific gating
 */
export async function getAuthenticatedUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

/**
 * Resolves the authenticated user AND enforces the swiper suspension gate.
 * When Stripe terminates the connected account (requirements.disabled_reason
 * starts with 'rejected.'), the account.updated webhook flips
 * stripe_accounts.suspended; this helper force-signouts that user and returns
 * null. Reserved for swiper-only routes — the orderer surface uses the cheap
 * getAuthenticatedUser to skip the per-request stripe_accounts SELECT.
 * @returns the User when not suspended; null when unauthenticated or suspended
 * @called-by app/api/swiper/pending, app/api/orders/[id]/accept, app/api/orders/[id]/status (swiper branches), app/api/stripe/connect/*, app/swiper/layout.tsx
 */
export async function getAuthenticatedSwiper(supabase: SupabaseClient) {
  const user = await getAuthenticatedUser(supabase)
  if (!user) return null

  const { data: stripeAccount } = await supabase
    .from('stripe_accounts')
    .select('suspended')
    .eq('user_id', user.id)
    .maybeSingle()

  if ((stripeAccount as { suspended?: boolean } | null)?.suspended === true) {
    await supabase.auth.signOut()
    return null
  }

  return user
}

export const CART_SESSION_COOKIE = 'cart_session_id'

export function getOrCreateSessionId(cookies: ReadonlyRequestCookies): {
  sessionId: string
  isNew: boolean
} {
  const existing = cookies.get(CART_SESSION_COOKIE)?.value
  if (existing) return { sessionId: existing, isNew: false }
  return { sessionId: randomUUID(), isNew: true }
}
