'use server'

/**
 * @file actions.ts
 * @description Server actions for the forgot-password OTP flow:
 *   `requestPasswordReset` triggers a 6-digit recovery code via email, and
 *   `verifyRecoveryOtp` exchanges the code for a recovery session that
 *   /auth/reset-password can use to call updateUser({ password }).
 *   Single-tab by construction — no link is sent, so PKCE / link-prefetcher /
 *   URL-rewriter failure modes cannot apply.
 *   Called by: app/auth/forgot-password/forgot-form.tsx
 * @dependencies lib/supabase/server.ts, lib/types/api.ts
 */

import { createClient } from '@/lib/supabase/server'
import { forgotPasswordSchema } from '@/lib/types/api'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ForgotPasswordState =
  | { sent: true; email: string }
  | { error: string }
  | null

export type VerifyRecoveryState =
  | { success: true }
  | { error: string }
  | null

/**
 * Sends a 6-digit password-reset code via Supabase email.
 * @param _prevState - Previous action state (unused; required by useActionState)
 * @param formData - Form data; reads the `email` field
 * @returns { sent: true, email } on success; { error } on validation or Supabase failure
 * @called-by app/auth/forgot-password/forgot-form.tsx
 */
export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get('email'),
  })
  if (!parsed.success) {
    return { error: 'Please enter a valid email address.' }
  }

  const supabase = await createClient()
  // No `redirectTo` — Supabase falls back to the OTP token in the email
  // template, which we render via supabase/templates/recovery.html.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email)

  if (error) {
    console.error('requestPasswordReset: resetPasswordForEmail failed', error)
    return { error: 'Could not send reset email. Please try again.' }
  }

  return { sent: true, email: parsed.data.email }
}

/**
 * Re-sends a 6-digit recovery code to `email`. Mirrors requestPasswordReset
 * but is invoked from the OTP step's "Resend code" button — kept as a
 * separate action so the client can call it without resetting useActionState.
 * @param email - Address that originally requested the reset
 * @returns void; logs Supabase failures but does not surface them.
 * @called-by app/auth/forgot-password/forgot-form.tsx
 */
export async function resendRecoveryOtp(email: string): Promise<void> {
  const trimmed = email?.trim() ?? ''
  if (!trimmed || !EMAIL_REGEX.test(trimmed)) return
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed)
  if (error) {
    console.error('resendRecoveryOtp: resetPasswordForEmail failed', error)
  }
}

/**
 * Verifies the 6-digit recovery OTP and establishes a recovery session in
 * this tab. After success the client navigates to /auth/reset-password,
 * which already accepts the recovery session and renders the new-password
 * form.
 * @param _prevState - Previous action state (unused; required by useActionState)
 * @param formData - Form data; reads `email` (hidden) and `token` (6 digits)
 * @returns { success: true } on success; { error } on validation or
 *   verifyOtp failure
 * @called-by app/auth/forgot-password/forgot-form.tsx
 */
export async function verifyRecoveryOtp(
  _prevState: VerifyRecoveryState,
  formData: FormData,
): Promise<VerifyRecoveryState> {
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const token = (formData.get('token') as string | null)?.trim() ?? ''

  if (!email || !EMAIL_REGEX.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }
  if (!/^\d{6}$/.test(token)) {
    return { error: 'Enter the 6-digit code from your email.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' })
  if (error || !data.session) {
    return { error: 'Invalid or expired code. Try again or request a new one.' }
  }

  return { success: true }
}
