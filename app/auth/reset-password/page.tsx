/**
 * @file page.tsx
 * @description Reset-password landing page; guards on the recovery session
 *   established by /auth/callback. Anonymous visitors are redirected to
 *   /auth/forgot-password since the form would have nothing to update.
 *   Called by: Next.js routing (/auth/reset-password)
 * @dependencies lib/supabase/server.ts, app/auth/reset-password/reset-form.tsx
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResetPasswordForm } from './reset-form'

/**
 * Verifies a session exists, then renders the new-password form.
 * @returns ResetPasswordForm; redirects to /auth/forgot-password if there is no session
 * @called-by Next.js routing (/auth/reset-password)
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Without a recovery session the updateUser() call would fail with
  // "Auth session missing!" — kick the user back to the request flow.
  if (!user) {
    redirect('/auth/forgot-password')
  }

  return <ResetPasswordForm />
}
