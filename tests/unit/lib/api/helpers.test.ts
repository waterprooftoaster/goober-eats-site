/**
 * @file helpers.test.ts
 * @description Unit tests for the auth helpers in lib/api/helpers.ts. The cheap
 *   getAuthenticatedUser performs only supabase.auth.getUser() — used on every
 *   authed API call. The swiper-aware getAuthenticatedSwiper additionally reads
 *   stripe_accounts.suspended and force-signs-out terminated swipers; reserved
 *   for the small set of swiper-only routes (see lib/api/helpers.ts JSDoc).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getAuthenticatedUser, getAuthenticatedSwiper } from '@/lib/api/helpers'

interface FixtureOptions {
  user: { id: string } | null
  stripeAccount?: { suspended: boolean } | null
}

function makeSupabase(opts: FixtureOptions, signOut = vi.fn().mockResolvedValue({ error: null })) {
  const stripeRow = opts.stripeAccount ?? null
  const fromMock = vi.fn(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: stripeRow, error: null }),
      }),
    }),
  }))
  const supabase = {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: opts.user }, error: opts.user ? null : new Error('no user') }),
      signOut,
    },
    from: fromMock,
  } as unknown as SupabaseClient
  return { supabase, fromMock }
}

const USER_ID = '00000000-0000-4000-8000-000000000001'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getAuthenticatedUser — cheap path', () => {
  it('returns the user when auth.getUser succeeds', async () => {
    const { supabase } = makeSupabase({ user: { id: USER_ID } })
    const user = await getAuthenticatedUser(supabase)
    expect(user).toEqual({ id: USER_ID })
  })

  it('returns null when no auth user is present', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    const { supabase } = makeSupabase({ user: null }, signOut)
    const user = await getAuthenticatedUser(supabase)
    expect(user).toBeNull()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('does NOT query stripe_accounts (cheap path)', async () => {
    const { supabase, fromMock } = makeSupabase({
      user: { id: USER_ID },
      stripeAccount: { suspended: true },
    })
    const user = await getAuthenticatedUser(supabase)
    expect(user).toEqual({ id: USER_ID })
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('getAuthenticatedSwiper — suspension gate', () => {
  it('returns the user when no stripe_accounts row exists (orderer-style)', async () => {
    const { supabase } = makeSupabase({ user: { id: USER_ID }, stripeAccount: null })
    const user = await getAuthenticatedSwiper(supabase)
    expect(user).toEqual({ id: USER_ID })
  })

  it('returns the user when stripe_accounts.suspended is false', async () => {
    const { supabase } = makeSupabase({ user: { id: USER_ID }, stripeAccount: { suspended: false } })
    const user = await getAuthenticatedSwiper(supabase)
    expect(user).toEqual({ id: USER_ID })
  })

  it('signs the user out and returns null when stripe_accounts.suspended is true', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    const { supabase } = makeSupabase(
      { user: { id: USER_ID }, stripeAccount: { suspended: true } },
      signOut
    )
    const user = await getAuthenticatedSwiper(supabase)
    expect(user).toBeNull()
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('returns null when no auth user is present (no signOut, no DB lookup)', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    const { supabase, fromMock } = makeSupabase({ user: null }, signOut)
    const user = await getAuthenticatedSwiper(supabase)
    expect(user).toBeNull()
    expect(signOut).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })
})
