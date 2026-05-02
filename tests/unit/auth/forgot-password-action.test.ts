/**
 * @file forgot-password-action.test.ts
 * @description Unit tests for the forgot-password OTP server actions —
 *   Zod validation on requestPasswordReset, the no-redirectTo signature it
 *   hands to resetPasswordForEmail, and the verifyRecoveryOtp success /
 *   failure paths.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockResetPasswordForEmail, mockVerifyOtp } = vi.hoisted(() => ({
  mockResetPasswordForEmail: vi.fn(),
  mockVerifyOtp: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        resetPasswordForEmail: mockResetPasswordForEmail,
        verifyOtp: mockVerifyOtp,
      },
    }),
  ),
}))

import { requestPasswordReset, verifyRecoveryOtp } from '@/app/auth/forgot-password/actions'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requestPasswordReset', () => {
  it('returns an error state when email is missing', async () => {
    const formData = new FormData()
    const result = await requestPasswordReset(null, formData)
    expect(result).toEqual({ error: expect.any(String) })
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('returns an error state when email is malformed', async () => {
    const formData = new FormData()
    formData.set('email', 'not-an-email')
    const result = await requestPasswordReset(null, formData)
    expect(result).toEqual({ error: expect.any(String) })
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('calls resetPasswordForEmail without a redirectTo on valid input', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })
    const formData = new FormData()
    formData.set('email', 'student@school.edu')

    const result = await requestPasswordReset(null, formData)

    // No second argument: Supabase falls back to the OTP token in the
    // recovery email template. Cross-browser/cross-device clicks no
    // longer matter because the user types the code into the same tab.
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('student@school.edu')
    expect(result).toEqual({ sent: true, email: 'student@school.edu' })
  })

  it('returns an error state when supabase reports a failure', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: { message: 'rate limit exceeded' },
    })
    const formData = new FormData()
    formData.set('email', 'student@school.edu')

    const result = await requestPasswordReset(null, formData)

    expect(result).toEqual({ error: expect.any(String) })
  })
})

describe('verifyRecoveryOtp', () => {
  it('rejects a missing or malformed email', async () => {
    const formData = new FormData()
    formData.set('email', '')
    formData.set('token', '123456')
    expect(await verifyRecoveryOtp(null, formData)).toEqual({ error: expect.any(String) })
    expect(mockVerifyOtp).not.toHaveBeenCalled()
  })

  it('rejects a token that is not 6 digits', async () => {
    const formData = new FormData()
    formData.set('email', 'student@school.edu')
    formData.set('token', '12ab56')
    expect(await verifyRecoveryOtp(null, formData)).toEqual({ error: expect.any(String) })
    expect(mockVerifyOtp).not.toHaveBeenCalled()
  })

  it('returns success when supabase establishes a recovery session', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: { access_token: 'fake' }, user: { email: 'student@school.edu' } },
      error: null,
    })
    const formData = new FormData()
    formData.set('email', 'student@school.edu')
    formData.set('token', '123456')

    const result = await verifyRecoveryOtp(null, formData)

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'student@school.edu',
      token: '123456',
      type: 'recovery',
    })
    expect(result).toEqual({ success: true })
  })

  it('returns an error state when supabase rejects the OTP', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'invalid token' },
    })
    const formData = new FormData()
    formData.set('email', 'student@school.edu')
    formData.set('token', '999999')

    expect(await verifyRecoveryOtp(null, formData)).toEqual({ error: expect.any(String) })
  })
})
