'use client'

/**
 * @file login-form.tsx
 * @description Multi-step login/sign-up form (email → password → name → school)
 *   built on the redesigned OKLCH-126 primitive set. Preserves the S01 state
 *   machine, every catalog testid, and the onboarding-resume sub-branch
 *   triggered when an authenticated user lands here without a profile row.
 *   Errors render inline (role="alert"), never as toasts.
 *   Called by: app/auth/login/page.tsx
 * @dependencies app/auth/actions.ts, components/ui/{button,input,combobox}
 */

import { useActionState, useEffect, useState } from 'react'
import { authenticate, completeOnboarding } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface School {
  id: string
  name: string
}

interface LoginFormProps {
  callbackError?: string
  schools: School[]
  initialOnboarding?: boolean
  userEmail?: string
}

/**
 * Renders the multi-step authentication form (email → password → name → school).
 * @param callbackError - Error message from OAuth callback query param
 * @param schools - Available schools for the onboarding school-selection step
 * @param initialOnboarding - Start directly at the name step (returning user without profile)
 * @param userEmail - Pre-fill the email field (used during onboarding resume)
 * @returns Multi-step auth/onboarding form
 * @called-by app/auth/login/page.tsx
 */
export function LoginForm({
  callbackError,
  schools,
  initialOnboarding,
  userEmail,
}: LoginFormProps) {
  const [step, setStep] = useState<'email' | 'password' | 'name' | 'school'>(
    initialOnboarding ? 'name' : 'email',
  )
  const [email, setEmail] = useState(userEmail ?? '')
  const [emailError, setEmailError] = useState('')
  const [emailExists, setEmailExists] = useState<boolean | null>(null)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [fullName, setFullName] = useState('')
  const [selectedSchool, setSelectedSchool] = useState<{ value: string; label: string } | null>(null)
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('')

  const [authState, formAction, authPending] = useActionState(authenticate, null)
  const [onboardingState, onboardingAction, onboardingPending] = useActionState(
    completeOnboarding,
    null,
  )

  // When authenticate signals onboarding is needed, derive the step and email from authState.
  // Once the user advances to 'school', step takes over (needsOnboarding && step !== 'school').
  const needsOnboarding = !!authState && 'needsOnboarding' in authState
  const effectiveStep = (needsOnboarding && step !== 'school') ? 'name' : step
  const effectiveEmail = needsOnboarding
    ? (authState as { email: string }).email
    : email

  // Defensive reset: whenever onboarding starts (either via initialOnboarding
  // from the server, or via authState.needsOnboarding after a successful
  // sign-up), force a fresh school choice. Cover-page school selection is
  // intentionally ephemeral, but this guarantees sign-up always asks again
  // even if a future change seeds these fields from elsewhere.
  useEffect(() => {
    if (initialOnboarding || needsOnboarding) {
      setSelectedSchool(null)
      setSchoolSearchQuery('')
    }
  }, [initialOnboarding, needsOnboarding])

  async function handleContinue() {
    if (!email || !EMAIL_REGEX.test(email)) {
      setEmailError('Please enter a valid email address.')
      return
    }
    setEmailError('')
    setCheckingEmail(true)

    try {
      const res = await fetch(
        '/api/auth/check-email?email=' + encodeURIComponent(email),
      )
      const body = await res.json()
      setEmailExists(body.exists ?? false)
    } catch {
      // Default to sign-up mode on network error
      setEmailExists(false)
    }

    setCheckingEmail(false)
    setStep('password')
  }

  const passwordError =
    authState && 'error' in authState ? authState.error : null
  const onboardingError =
    onboardingState && 'error' in onboardingState ? onboardingState.error : null

  return (
    <main
      data-testid="auth-login-page"
      className="mx-auto flex min-h-screen max-w-sm flex-col px-6 pt-16 pb-12 sm:pt-24"
    >
      <div className="flex flex-col gap-6">
        {effectiveStep === 'email' && (
          <>
            {callbackError && (
              <p
                data-testid="auth-callback-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {callbackError}
              </p>
            )}

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Enter your email
            </h1>

            <div className="flex flex-col gap-1.5">
              <Input
                type="email"
                placeholder="you@school.edu"
                value={effectiveEmail}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleContinue()
                  }
                }}
                data-testid="auth-email-input"
                autoComplete="email"
                className="h-11"
              />
              {emailError && (
                <p role="alert" className="text-sm text-destructive">
                  {emailError}
                </p>
              )}
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handleContinue}
              disabled={checkingEmail}
              data-testid="auth-continue-button"
              className="h-11 w-full"
            >
              {checkingEmail ? '…' : 'Continue'}
            </Button>
          </>
        )}

        {effectiveStep === 'password' && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep('email')}
              data-testid="auth-back-button"
              className="-ml-2 self-start"
            >
              ← Back
            </Button>

            {passwordError && (
              <p
                data-testid="auth-form-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {passwordError}
              </p>
            )}

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {emailExists ? 'Welcome back' : 'Create your password'}
            </h1>

            <form action={formAction} className="flex flex-col gap-4">
              <input type="hidden" name="email" value={effectiveEmail} />

              <Input
                name="password"
                type="password"
                placeholder="Password"
                required
                minLength={6}
                data-testid="auth-password-input"
                autoComplete={emailExists ? 'current-password' : 'new-password'}
                className="h-11"
              />

              {emailExists === false && (
                <Input
                  name="confirm_password"
                  type="password"
                  placeholder="Confirm password"
                  required
                  minLength={6}
                  data-testid="auth-password-confirm-input"
                  autoComplete="new-password"
                  className="h-11"
                />
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={authPending}
                data-testid={emailExists ? 'auth-signin-button' : 'auth-signup-button'}
                className="h-11 w-full"
              >
                {authPending
                  ? '…'
                  : emailExists
                    ? 'Sign In'
                    : 'Sign Up'}
              </Button>
            </form>
          </>
        )}

        {effectiveStep === 'name' && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              What should we call you?
            </h1>

            <Input
              type="text"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
              data-testid="auth-fullname-input"
              autoComplete="name"
              className="h-11"
            />

            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => setStep('school')}
              disabled={!fullName.trim()}
              data-testid="auth-name-continue-button"
              className="h-11 w-full"
            >
              Continue
            </Button>
          </>
        )}

        {effectiveStep === 'school' && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep('name')}
              data-testid="auth-back-button"
              className="-ml-2 self-start"
            >
              ← Back
            </Button>

            {onboardingError && (
              <p
                data-testid="auth-form-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {onboardingError}
              </p>
            )}

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Where do you go to school?
            </h1>

            <form action={onboardingAction} className="flex flex-col gap-4">
              <input type="hidden" name="full_name" value={fullName} />

              <div data-testid="auth-school-input">
                <Combobox
                  value={selectedSchool}
                  onValueChange={(value) =>
                    setSelectedSchool(value as { value: string; label: string } | null)
                  }
                  onInputValueChange={(inputValue) =>
                    setSchoolSearchQuery(inputValue)
                  }
                  isItemEqualToValue={(a, b) => a.value === b.value}
                  autoHighlight
                >
                  <ComboboxInput
                    placeholder="Search schools…"
                    className="h-11 text-base"
                  />
                  <ComboboxContent>
                    <ComboboxList>
                      {schools.map((school) => (
                        <ComboboxItem
                          key={school.id}
                          value={{ value: school.id, label: school.name }}
                          className="py-3 text-base"
                        >
                          {school.name}
                        </ComboboxItem>
                      ))}
                      {schoolSearchQuery.trim().length > 0 && (
                        <ComboboxEmpty>No schools found</ComboboxEmpty>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <input type="hidden" name="school_id" value={selectedSchool?.value ?? ''} />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={onboardingPending || !selectedSchool}
                data-testid="auth-onboarding-complete-button"
                className="h-11 w-full"
              >
                {onboardingPending ? '…' : 'Get Started'}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
