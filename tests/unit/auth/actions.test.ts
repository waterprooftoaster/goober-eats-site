/**
 * @file actions.test.ts
 * @description Unit tests for authenticate (sign-in) + verifySignupOtp
 *   (final step of sign-up) — the suspension gate on sign-in, and the
 *   OTP-then-profile-creation path now that the OTP is the very last
 *   step of the sign-up flow.
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
  const FULL_NAME = 'Jane Student'
  const SCHOOL_ID = '11111111-1111-4111-8111-111111111111'

  function otpForm(
    email: string,
    token: string,
    extras: { full_name?: string; school_id?: string } = {},
  ): FormData {
    const fd = new FormData()
    fd.set('email', email)
    fd.set('token', token)
    if (extras.full_name !== undefined) fd.set('full_name', extras.full_name)
    if (extras.school_id !== undefined) fd.set('school_id', extras.school_id)
    return fd
  }

  function makeVerifyClient(opts: {
    verifyOtpResult?: unknown
    profileInsertError?: { message: string } | null
  }) {
    const verifyOtp = vi.fn().mockResolvedValue(
      opts.verifyOtpResult ?? {
        data: { session: { access_token: 'fake' }, user: { id: USER_ID, email: EMAIL } },
        error: null,
      },
    )
    const insert = vi.fn().mockResolvedValue({ error: opts.profileInsertError ?? null })
    const client = {
      auth: { verifyOtp },
      from: (_: string) => ({ insert }),
    }
    return { client, verifyOtp, insert }
  }

  it('rejects a missing or malformed email', async () => {
    const verifyOtp = vi.fn()
    mockCreateClient.mockResolvedValue({ auth: { verifyOtp } })

    expect(
      await verifySignupOtp(null, otpForm('', '123456', { full_name: FULL_NAME, school_id: SCHOOL_ID })),
    ).toEqual({ error: expect.any(String) })
    expect(
      await verifySignupOtp(
        null,
        otpForm('not-an-email', '123456', { full_name: FULL_NAME, school_id: SCHOOL_ID }),
      ),
    ).toEqual({ error: expect.any(String) })
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('rejects a token that is not 6 digits', async () => {
    const verifyOtp = vi.fn()
    mockCreateClient.mockResolvedValue({ auth: { verifyOtp } })

    expect(
      await verifySignupOtp(null, otpForm(EMAIL, '12ab56', { full_name: FULL_NAME, school_id: SCHOOL_ID })),
    ).toEqual({ error: expect.any(String) })
    expect(
      await verifySignupOtp(null, otpForm(EMAIL, '12345', { full_name: FULL_NAME, school_id: SCHOOL_ID })),
    ).toEqual({ error: expect.any(String) })
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('creates the profile and returns success when name + school are provided', async () => {
    const { client, verifyOtp, insert } = makeVerifyClient({})
    mockCreateClient.mockResolvedValue(client)

    const result = await verifySignupOtp(
      null,
      otpForm(EMAIL, '123456', { full_name: FULL_NAME, school_id: SCHOOL_ID }),
    )

    expect(verifyOtp).toHaveBeenCalledWith({ email: EMAIL, token: '123456', type: 'signup' })
    expect(insert).toHaveBeenCalledWith({
      id: USER_ID,
      full_name: FULL_NAME,
      email: EMAIL,
      school_id: SCHOOL_ID,
    })
    expect(result).toEqual({ success: true })
  })

  it('falls back to needsOnboarding when name/school are missing (resume path)', async () => {
    const { client, verifyOtp, insert } = makeVerifyClient({})
    mockCreateClient.mockResolvedValue(client)

    const result = await verifySignupOtp(null, otpForm(EMAIL, '123456'))

    expect(verifyOtp).toHaveBeenCalledWith({ email: EMAIL, token: '123456', type: 'signup' })
    expect(insert).not.toHaveBeenCalled()
    expect(result).toEqual({ needsOnboarding: true, email: EMAIL })
  })

  it('returns an error state when supabase rejects the code', async () => {
    const { client } = makeVerifyClient({
      verifyOtpResult: { data: { session: null, user: null }, error: { message: 'invalid token' } },
    })
    mockCreateClient.mockResolvedValue(client)

    expect(
      await verifySignupOtp(null, otpForm(EMAIL, '999999', { full_name: FULL_NAME, school_id: SCHOOL_ID })),
    ).toEqual({ error: expect.any(String) })
  })

  it('returns an error when the profile insert fails', async () => {
    const { client } = makeVerifyClient({
      profileInsertError: { message: 'unique violation' },
    })
    mockCreateClient.mockResolvedValue(client)

    const result = await verifySignupOtp(
      null,
      otpForm(EMAIL, '123456', { full_name: FULL_NAME, school_id: SCHOOL_ID }),
    )
    expect(result).toEqual({ error: expect.any(String) })
  })
})
