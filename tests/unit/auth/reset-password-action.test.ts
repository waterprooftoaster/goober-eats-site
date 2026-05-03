/**
 * @file reset-password-action.test.ts
 * @description Unit tests for the resetPassword server action — Zod
 *   validation, supabase.auth.updateUser invocation, and success/error
 *   state shapes.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockUpdateUser, mockSignOut } = vi.hoisted(() => ({
  mockUpdateUser: vi.fn(),
  mockSignOut: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { updateUser: mockUpdateUser, signOut: mockSignOut },
    }),
  ),
}))

import { resetPassword } from '@/app/auth/reset-password/actions'

describe('resetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue({ error: null })
  })

  it('returns an error state when password is missing', async () => {
    const formData = new FormData()
    const result = await resetPassword(null, formData)
    expect(result).toEqual({ error: expect.any(String) })
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('returns an error state when password is shorter than 8 characters', async () => {
    const formData = new FormData()
    formData.set('password', 'short')
    const result = await resetPassword(null, formData)
    expect(result).toEqual({ error: expect.any(String) })
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('calls supabase.updateUser with the new password and returns success on valid input', async () => {
    mockUpdateUser.mockResolvedValue({ error: null })
    const formData = new FormData()
    formData.set('password', 'newpassword123')

    const result = await resetPassword(null, formData)

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpassword123' })
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ success: true })
  })

  it('does not sign out when the password update fails', async () => {
    mockUpdateUser.mockResolvedValue({
      error: { message: 'session expired' },
    })
    const formData = new FormData()
    formData.set('password', 'newpassword123')

    const result = await resetPassword(null, formData)

    expect(result).toEqual({ error: expect.any(String) })
    expect(mockSignOut).not.toHaveBeenCalled()
  })
})
