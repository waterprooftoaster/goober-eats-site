'use server'

/**
 * @file actions.ts
 * @description Server action that triggers a Supabase password-reset email.
 *   Validates the email with Zod, then asks supabase.auth.resetPasswordForEmail
 *   to send a recovery link that lands on /auth/callback?next=/auth/reset-password.
 *   Called by: app/auth/forgot-password/forgot-form.tsx
 * @dependencies lib/supabase/server.ts, lib/types/api.ts
 */

import { createClient } from '@/lib/supabase/server'
import { forgotPasswordSchema } from '@/lib/types/api'

export type ForgotPasswordState =
  | { sent: true; email: string }
  | { error: string }
  | null

/**
 * Sends a password-reset email via Supabase, scoped to /auth/reset-password.
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
  const siteUrl = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
  })

  if (error) {
    console.error('requestPasswordReset: resetPasswordForEmail failed', error)
    return { error: 'Could not send reset email. Please try again.' }
  }

  return { sent: true, email: parsed.data.email }
}
