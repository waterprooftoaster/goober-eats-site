/**
 * @file forgot-password-action.test.ts
 * @description Unit tests for the requestPasswordReset server action — Zod
 *   validation, success/error states, and the redirectTo URL handed to
 *   supabase.auth.resetPasswordForEmail.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockResetPasswordForEmail } = vi.hoisted(() => ({
  mockResetPasswordForEmail: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { resetPasswordForEmail: mockResetPasswordForEmail },
    }),
  ),
}))

import { requestPasswordReset } from '@/app/auth/forgot-password/actions'

describe('requestPasswordReset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_URL = 'http://localhost:3000'
  })

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

  it('calls supabase.resetPasswordForEmail with the configured callback URL on valid input', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })
    const formData = new FormData()
    formData.set('email', 'student@school.edu')

    const result = await requestPasswordReset(null, formData)

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('student@school.edu', {
      redirectTo: 'http://localhost:3000/auth/callback?next=/auth/reset-password',
    })
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
