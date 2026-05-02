/**
 * @file actions.test.ts
 * @description Unit tests for the authenticate + verifySignupOtp server
 *   actions — the suspension gate on sign-in, and the OTP-only signup
 *   verification path that replaced the old /auth/callback magic-link flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// `server-only` throws if loaded in a jsdom environment; the chain
// `app/auth/actions → lib/auth/claim-guest-orders` pulls it in, so neutralize
// it the same way other server-action tests do.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/claim-guest-orders', () => ({
  claimGuestOrders: vi.fn().mockResolvedValue({ claimedOrderIds: [] }),
  clearGuestOrderCookies: vi.fn().mockResolvedValue(undefined),
}))

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

import { authenticate, verifySignupOtp } from '@/app/auth/actions'

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

describe('verifySignupOtp', () => {
  function otpForm(email: string, token: string): FormData {
    const fd = new FormData()
    fd.set('email', email)
    fd.set('token', token)
    return fd
  }

  it('rejects a missing or malformed email', async () => {
    const verifyOtp = vi.fn()
    mockCreateClient.mockResolvedValue({ auth: { verifyOtp } })

    expect(await verifySignupOtp(null, otpForm('', '123456'))).toEqual({ error: expect.any(String) })
    expect(await verifySignupOtp(null, otpForm('not-an-email', '123456'))).toEqual({
      error: expect.any(String),
    })
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('rejects a token that is not 6 digits', async () => {
    const verifyOtp = vi.fn()
    mockCreateClient.mockResolvedValue({ auth: { verifyOtp } })

    expect(await verifySignupOtp(null, otpForm(EMAIL, '12ab56'))).toEqual({
      error: expect.any(String),
    })
    expect(await verifySignupOtp(null, otpForm(EMAIL, '12345'))).toEqual({
      error: expect.any(String),
    })
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('returns needsOnboarding on a verifyOtp success', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: { session: { access_token: 'fake' }, user: { id: USER_ID, email: EMAIL } },
      error: null,
    })
    mockCreateClient.mockResolvedValue({ auth: { verifyOtp } })

    const result = await verifySignupOtp(null, otpForm(EMAIL, '123456'))

    expect(verifyOtp).toHaveBeenCalledWith({ email: EMAIL, token: '123456', type: 'signup' })
    expect(result).toEqual({ needsOnboarding: true, email: EMAIL })
  })

  it('returns an error state when supabase rejects the code', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'invalid token' },
    })
    mockCreateClient.mockResolvedValue({ auth: { verifyOtp } })

    expect(await verifySignupOtp(null, otpForm(EMAIL, '999999'))).toEqual({
      error: expect.any(String),
    })
  })
})
