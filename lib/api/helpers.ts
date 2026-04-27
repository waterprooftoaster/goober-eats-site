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
