'use server'

/**
 * @file actions.ts
 * @description Server action that updates the authenticated user's password.
 *   Reaches the user via the recovery session established by
 *   app/auth/forgot-password's verifyRecoveryOtp action.
 *   Called by: app/auth/reset-password/reset-form.tsx
 * @dependencies lib/supabase/server.ts, lib/types/api.ts
 */

import { createClient } from '@/lib/supabase/server'
import { resetPasswordSchema } from '@/lib/types/api'

export type ResetPasswordState =
  | { success: true }
  | { error: string }
  | null

/**
 * Persists a new password against the active recovery session.
 * @param _prevState - Previous action state (unused; required by useActionState)
 * @param formData - Form data; reads the `password` field
 * @returns { success: true } on success; { error } on validation or Supabase failure
 * @called-by app/auth/reset-password/reset-form.tsx
 */
export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    console.error('resetPassword: updateUser failed', error)
    return { error: 'Could not update password. Please try again.' }
  }

  return { success: true }
}
