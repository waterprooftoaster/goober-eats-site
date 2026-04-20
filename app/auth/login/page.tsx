/**
 * @file page.tsx
 * @description Login page that pre-fetches schools and determines if onboarding should be shown.
 *   Called by: Next.js routing (direct navigation to /auth/login)
 * @dependencies lib/supabase/server.ts, app/auth/login/login-form.tsx
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LoginForm } from './login-form'

const ALLOWED_ERRORS: Record<string, string> = {
  'Could not complete authentication': 'Could not complete authentication.',
}

/**
 * Fetches schools and resolves onboarding state, then renders the login/sign-up form.
 * @returns LoginForm component; redirects to / if the user already has a profile
 * @called-by Next.js routing (/auth/login)
 */
export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string; onboarding?: string }>
}) {
  const { error, onboarding } = await props.searchParams
  const callbackError = error ? ALLOWED_ERRORS[error] : undefined

  const supabase = await createClient()

  // Prefetch schools so they're ready instantly for onboarding
  const { data: schools } = await supabase
    .from('schools')
    .select('id, name')
    .order('name')

  // Determine if we should show onboarding
  let initialOnboarding = onboarding === 'true'
  let userEmail: string | undefined

  // Also check: authenticated user with no profile (handles page refresh during onboarding)
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      initialOnboarding = true
      userEmail = user.email ?? undefined
    } else {
      // Already authenticated with a profile — go home
      redirect('/')
    }
  }

  return (
    <LoginForm
      callbackError={callbackError}
      schools={schools ?? []}
      initialOnboarding={initialOnboarding}
      userEmail={userEmail}
    />
  )
}
