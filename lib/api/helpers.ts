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

export async function getAuthenticatedUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null

  // Suspension gate: when Stripe permanently terminates the connected account
  // (requirements.disabled_reason starts with 'rejected.'), the webhook flips
  // stripe_accounts.suspended. Force-signout and treat as unauthenticated.
  // Non-swipers have no stripe_accounts row → maybeSingle returns null → pass
  // through. Cost: one indexed single-row SELECT per authenticated API call.
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
