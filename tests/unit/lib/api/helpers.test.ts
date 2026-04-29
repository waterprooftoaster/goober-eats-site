/**
 * @file helpers.test.ts
 * @description Unit tests for getAuthenticatedUser — focuses on the suspension
 *   gate added in Phase 2 of the architecture-cleanup plan: authenticated users
 *   whose stripe_accounts.suspended === true are forcibly signed out and
 *   getAuthenticatedUser returns null. Non-swipers (no stripe_accounts row) and
 *   non-suspended swipers pass through unchanged.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getAuthenticatedUser } from '@/lib/api/helpers'

interface FixtureOptions {
  user: { id: string } | null
  stripeAccount?: { suspended: boolean } | null
}

function makeSupabase(opts: FixtureOptions, signOut = vi.fn().mockResolvedValue({ error: null })): SupabaseClient {
  const stripeRow = opts.stripeAccount ?? null
  return {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: opts.user }, error: opts.user ? null : new Error('no user') }),
      signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: stripeRow, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient
}

const USER_ID = '00000000-0000-4000-8000-000000000001'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getAuthenticatedUser — suspension gate', () => {
  it('returns the user when no stripe_accounts row exists (orderer)', async () => {
    const supabase = makeSupabase({ user: { id: USER_ID }, stripeAccount: null })
    const user = await getAuthenticatedUser(supabase)
    expect(user).toEqual({ id: USER_ID })
  })

  it('returns the user when stripe_accounts.suspended is false', async () => {
    const supabase = makeSupabase({ user: { id: USER_ID }, stripeAccount: { suspended: false } })
    const user = await getAuthenticatedUser(supabase)
    expect(user).toEqual({ id: USER_ID })
  })

  it('signs the user out and returns null when stripe_accounts.suspended is true', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    const supabase = makeSupabase(
      { user: { id: USER_ID }, stripeAccount: { suspended: true } },
      signOut
    )
    const user = await getAuthenticatedUser(supabase)
    expect(user).toBeNull()
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('returns null when no auth user is present (no signOut, no DB lookup)', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    const supabase = makeSupabase({ user: null }, signOut)
    const user = await getAuthenticatedUser(supabase)
    expect(user).toBeNull()
    expect(signOut).not.toHaveBeenCalled()
  })
})
