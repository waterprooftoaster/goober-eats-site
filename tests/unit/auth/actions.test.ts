/**
 * @file actions.test.ts
 * @description Unit tests for the authenticate server action — focused on the
 *   suspension gate added in Phase 2: a user whose stripe_accounts.suspended is
 *   true must be signed out and receive an error, not a success state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

import { authenticate } from '@/app/auth/actions'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const EMAIL = 'student@example.edu'
const PASSWORD = 'sup3rs3cret'

interface ClientFixture {
  signInResult?: { data: { user: { id: string; email: string } | null }; error: { message: string } | null }
  profile?: { id: string } | null
  stripeAccount?: { suspended: boolean } | null
}

function makeClient(opts: ClientFixture) {
  const signOut = vi.fn().mockResolvedValue({ error: null })
  const tableHits: string[] = []
  const client = {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue(
        opts.signInResult ?? {
          data: { user: { id: USER_ID, email: EMAIL } },
          error: null,
        }
      ),
      signOut,
    },
    from: (table: string) => {
      tableHits.push(table)
      const data =
        table === 'profiles'
          ? opts.profile ?? null
          : table === 'stripe_accounts'
          ? opts.stripeAccount ?? null
          : null
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data, error: null }),
          }),
        }),
      }
    },
  }
  return { client, signOut, tableHits }
}

function signInForm(): FormData {
  const fd = new FormData()
  fd.set('email', EMAIL)
  fd.set('password', PASSWORD)
  // confirm_password is intentionally absent — distinguishes sign-in from sign-up.
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('authenticate — suspension gate (sign-in path)', () => {
  it('returns success for a non-suspended user with a profile', async () => {
    const { client } = makeClient({
      profile: { id: USER_ID },
      stripeAccount: { suspended: false },
    })
    mockCreateClient.mockResolvedValue(client)

    const result = await authenticate(null, signInForm())
    expect(result).toEqual({ success: true })
  })

  it('returns success for a non-swiper user (no stripe_accounts row)', async () => {
    const { client } = makeClient({
      profile: { id: USER_ID },
      stripeAccount: null,
    })
    mockCreateClient.mockResolvedValue(client)

    const result = await authenticate(null, signInForm())
    expect(result).toEqual({ success: true })
  })

  it('signs the user out and returns an error when stripe_accounts.suspended is true', async () => {
    const { client, signOut } = makeClient({
      profile: { id: USER_ID },
      stripeAccount: { suspended: true },
    })
    mockCreateClient.mockResolvedValue(client)

    const result = await authenticate(null, signInForm())
    expect(result).toEqual({ error: 'This account has been suspended.' })
    expect(signOut).toHaveBeenCalledTimes(1)
  })
})
