/**
 * @file resolve-principal.test.ts
 * @description Unit tests for resolvePrincipal — the §10 discriminated-union helper
 *   that maps (Supabase auth session, cookie store) → Principal. Covers all five
 *   variants (anon, authed_orderer, authed_swiper_pre_stripe, authed_swiper, guest_cookie),
 *   the auth-without-profile fallback, the schoolId-null swiper guard, and the
 *   guest-cookie precedence rules.
 *   Called by: Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { resolvePrincipal } from '@/lib/auth/resolve-principal'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('resolvePrincipal — anonymous + guest paths', () => {
  it('returns { kind: "anon" } when no auth user and no guest cookie', async () => {
    const supabase = makeSupabase({ user: null })
    const cookies = makeCookies([])

    const principal = await resolvePrincipal(supabase, cookies)

    expect(principal).toEqual({ kind: 'anon' })
  })

  it('returns { kind: "guest_cookie" } with extracted orderId when no user but a guest cookie is present', async () => {
    const supabase = makeSupabase({ user: null })
    const cookies = makeCookies([
      { name: `guest_order_token_${ORDER_ID}`, value: 'token-abc' },
    ])

    const principal = await resolvePrincipal(supabase, cookies)

    expect(principal).toEqual({ kind: 'guest_cookie', orderId: ORDER_ID, anonUserId: null })
  })

  it('ignores non-guest cookies', async () => {
    const supabase = makeSupabase({ user: null })
    const cookies = makeCookies([
      { name: 'sb-access-token', value: 'something' },
      { name: 'theme', value: 'dark' },
    ])

    const principal = await resolvePrincipal(supabase, cookies)

    expect(principal).toEqual({ kind: 'anon' })
  })

  it('returns { kind: "guest_cookie" } with anonUserId when user is anonymous AND a guest cookie exists', async () => {
    const supabase = makeSupabase({
      user: { id: ANON_USER_ID, is_anonymous: true },
    })
    const cookies = makeCookies([
      { name: `guest_order_token_${ORDER_ID}`, value: 'token-abc' },
    ])

    const principal = await resolvePrincipal(supabase, cookies)

    expect(principal).toEqual({
      kind: 'guest_cookie',
      orderId: ORDER_ID,
      anonUserId: ANON_USER_ID,
    })
  })

  it('returns { kind: "anon" } when user is anonymous but no guest cookie exists', async () => {
    const supabase = makeSupabase({
      user: { id: ANON_USER_ID, is_anonymous: true },
    })
    const cookies = makeCookies([])

    const principal = await resolvePrincipal(supabase, cookies)

    expect(principal).toEqual({ kind: 'anon' })
  })

  it('returns the first guest cookie when multiple are present', async () => {
    const otherOrderId = '00000000-0000-4000-8000-000000000002'
    const supabase = makeSupabase({ user: null })
    const cookies = makeCookies([
      { name: `guest_order_token_${ORDER_ID}`, value: 'token-1' },
      { name: `guest_order_token_${otherOrderId}`, value: 'token-2' },
    ])

    const principal = await resolvePrincipal(supabase, cookies)

    expect(principal).toEqual({ kind: 'guest_cookie', orderId: ORDER_ID, anonUserId: null })
  })
})

describe('resolvePrincipal — authed paths', () => {
  it('returns { kind: "anon" } when authed user has no profiles row (mid-onboarding)', async () => {
    const supabase = makeSupabase({
      user: { id: USER_ID, is_anonymous: false },
      profile: null,
    })
    const cookies = makeCookies([])

    const principal = await resolvePrincipal(supabase, cookies)

    expect(principal).toEqual({ kind: 'anon' })
  })

  it('returns { kind: "authed_orderer" } when profile exists and no stripe_accounts row', async () => {
    const supabase = makeSupabase({
      user: { id: USER_ID, is_anonymous: false },
      profile: { school_id: SCHOOL_ID },
      stripeAccount: null,
    })
    const cookies = makeCookies([])

    const principal = await resolvePrincipal(supabase, cookies)

    expect(principal).toEqual({
      kind: 'authed_orderer',
      userId: USER_ID,
      schoolId: SCHOOL_ID,
    })
  })

  it('returns { kind: "authed_orderer" } with schoolId=null when profile.school_id is null and no stripe row', async () => {
    const supabase = makeSupabase({
      user: { id: USER_ID, is_anonymous: false },
      profile: { school_id: null },
      stripeAccount: null,
    })
    const cookies = makeCookies([])

    const principal = await resolvePrincipal(supabase, cookies)

    expect(principal).toEqual({
      kind: 'authed_orderer',
      userId: USER_ID,
      schoolId: null,
    })
  })

  it('returns { kind: "authed_swiper_pre_stripe" } when stripe row exists with onboarding_complete=false', async () => {
    const supabase = makeSupabase({
      user: { id: USER_ID, is_anonymous: false },
      profile: { school_id: SCHOOL_ID },
      stripeAccount: { onboarding_complete: false },
    })
    const cookies = makeCookies([])

    const principal = await resolvePrincipal(supabase, cookies)

    expect(principal).toEqual({
      kind: 'authed_swiper_pre_stripe',
      userId: USER_ID,
      schoolId: SCHOOL_ID,
    })
  })

  it('returns { kind: "authed_swiper" } when stripe onboarding_complete=true and schoolId is set', async () => {
    const supabase = makeSupabase({
      user: { id: USER_ID, is_anonymous: false },
      profile: { school_id: SCHOOL_ID },
      stripeAccount: { onboarding_complete: true },
    })
    const cookies = makeCookies([])

    const principal = await resolvePrincipal(supabase, cookies)

    expect(principal).toEqual({
      kind: 'authed_swiper',
      userId: USER_ID,
      schoolId: SCHOOL_ID,
    })
  })

  it('falls back to authed_swiper_pre_stripe when stripe onboarding_complete=true but schoolId is null', async () => {
    // Data-inconsistency guard: full swiper variant requires a non-null schoolId.
    const supabase = makeSupabase({
      user: { id: USER_ID, is_anonymous: false },
      profile: { school_id: null },
      stripeAccount: { onboarding_complete: true },
    })
    const cookies = makeCookies([])

    const principal = await resolvePrincipal(supabase, cookies)

    expect(principal).toEqual({
      kind: 'authed_swiper_pre_stripe',
      userId: USER_ID,
      schoolId: null,
    })
  })

  it('signs the user out and returns anon when stripe_accounts.suspended=true', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    const supabase = makeSupabase({
      user: { id: USER_ID, is_anonymous: false },
      profile: { school_id: SCHOOL_ID },
      stripeAccount: { onboarding_complete: true, suspended: true },
      signOut,
    })
    const cookies = makeCookies([])

    const principal = await resolvePrincipal(supabase, cookies)

    expect(signOut).toHaveBeenCalledTimes(1)
    expect(principal).toEqual({ kind: 'anon' })
  })

  it('does NOT sign out when stripe_accounts.suspended=false', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    const supabase = makeSupabase({
      user: { id: USER_ID, is_anonymous: false },
      profile: { school_id: SCHOOL_ID },
      stripeAccount: { onboarding_complete: true, suspended: false },
      signOut,
    })
    const cookies = makeCookies([])

    await resolvePrincipal(supabase, cookies)

    expect(signOut).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const USER_ID = '99999999-0000-4000-8000-000000000001'
const ANON_USER_ID = '88888888-0000-4000-8000-000000000001'
const ORDER_ID = '00000000-0000-4000-8000-000000000001'
const SCHOOL_ID = '77777777-0000-4000-8000-000000000001'

interface FakeUser {
  id: string
  is_anonymous: boolean
}

interface SupabaseFixture {
  user: FakeUser | null
  profile?: { school_id: string | null } | null
  stripeAccount?: { onboarding_complete: boolean; suspended?: boolean } | null
  signOut?: () => Promise<{ error: unknown }>
}

function makeSupabase(fixture: SupabaseFixture): SupabaseClient {
  const tableResults: Record<string, unknown> = {
    profiles: fixture.profile ?? null,
    stripe_accounts: fixture.stripeAccount ?? null,
  }
  // Cast to SupabaseClient — only the surface resolvePrincipal touches matters.
  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: fixture.user }, error: null }),
      signOut: fixture.signOut ?? (() => Promise.resolve({ error: null })),
    },
    from: (table: string) => buildSelectChain(tableResults[table]),
  } as unknown as SupabaseClient
}

function buildSelectChain(row: unknown) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.maybeSingle = () => Promise.resolve({ data: row ?? null, error: null })
  return chain
}

interface FakeCookie {
  name: string
  value: string
}

function makeCookies(list: FakeCookie[]): ReadonlyRequestCookies {
  return {
    getAll: () => list,
    get: (name: string) => list.find((c) => c.name === name),
  } as unknown as ReadonlyRequestCookies
}
