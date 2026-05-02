/**
 * @file page.tsx
 * @description Login page that pre-fetches schools and determines if onboarding should be shown.
 *   Called by: Next.js routing (direct navigation to /auth/login)
 * @dependencies lib/supabase/server.ts, app/auth/login/login-form.tsx
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LoginForm } from './login-form'

/**
 * Fetches schools and resolves onboarding state, then renders the login/sign-up form.
 * @returns LoginForm component; redirects to / if the user already has a profile
 * @called-by Next.js routing (/auth/login)
 */
export default async function LoginPage(props: {
  searchParams: Promise<{ onboarding?: string }>
}) {
  const { onboarding } = await props.searchParams

  const supabase = await createClient()

  // Prefetch schools so they're ready instantly for onboarding
  const { data: schools } = await supabase
    .from('schools')
    .select('id, name')
    .order('name')

  // Determine if we should show onboarding
  let initialOnboarding = onboarding === 'true'
  let userEmail: string | undefined

  // Anonymous Supabase sessions (signInAnonymously) are not real sign-ups —
  // they have no email and shouldn't preempt the email→password→name→school
  // flow. Treat them like fully unauthenticated visitors here.
  const { data: { user } } = await supabase.auth.getUser()
  if (user && !user.is_anonymous) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, school_id')
      .eq('id', user.id)
      .maybeSingle()

    // Profile missing OR profile exists but school_id is null (the FK is
    // nullable + ON DELETE SET NULL on schools, so this can happen if the
    // referenced school was deleted) → user still owes us a school choice.
    if (!profile || !profile.school_id) {
      initialOnboarding = true
      userEmail = user.email ?? undefined
    } else {
      // Already authenticated with a complete profile — go home
      redirect('/')
    }
  }

  return (
    <LoginForm
      schools={schools ?? []}
      initialOnboarding={initialOnboarding}
      userEmail={userEmail}
    />
  )
}
