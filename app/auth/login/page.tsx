import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LoginForm } from './login-form'

const ALLOWED_ERRORS: Record<string, string> = {
  'Could not complete authentication': 'Could not complete authentication.',
}

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
