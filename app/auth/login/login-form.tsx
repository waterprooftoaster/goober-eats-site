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

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { authenticate, completeOnboarding, resendSignupOtp, verifySignupOtp } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ResendCodeButton } from '@/components/ui/resend-code-button'
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
  schools: School[]
  initialOnboarding?: boolean
  userEmail?: string
  next?: string
}

/**
 * Renders the multi-step authentication form (email → password → otp → name → school).
 * @param schools - Available schools for the onboarding school-selection step
 * @param initialOnboarding - Start directly at the name step (returning user without profile)
 * @param userEmail - Pre-fill the email field (used during onboarding resume)
 * @param next - Optional relative path to redirect to after successful auth/onboarding
 * @returns Multi-step auth/onboarding form
 * @called-by app/auth/login/page.tsx
 */
export function LoginForm({
  schools,
  initialOnboarding,
  userEmail,
  next,
}: LoginFormProps) {
  const [step, setStep] = useState<'email' | 'password' | 'otp' | 'name' | 'school'>(
    initialOnboarding ? 'name' : 'email',
  )
  const [email, setEmail] = useState(userEmail ?? '')
  const [emailError, setEmailError] = useState('')
  const [emailExists, setEmailExists] = useState<boolean | null>(null)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [signUpPasswordError, setSignUpPasswordError] = useState('')
  const [fullName, setFullName] = useState('')
  const [selectedSchool, setSelectedSchool] = useState<{ value: string; label: string } | null>(null)
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('')

  const [authState, formAction, authPending] = useActionState(authenticate, null)
  const [onboardingState, onboardingAction, onboardingPending] = useActionState(
    completeOnboarding,
    null,
  )
  const [otpState, otpAction, otpPending] = useActionState(verifySignupOtp, null)

  // When authenticate signals onboarding is needed, derive the step and email from authState.
  // Once the user advances to 'school', step takes over (needsOnboarding && step !== 'school').
  // When authenticate signals otpSent (sign-up confirmation pending), force the OTP entry
  // step until the user moves on to onboarding via verifyOtp's hard reload.
  const otpSent = !!authState && 'otpSent' in authState
  const needsOnboarding = !!authState && 'needsOnboarding' in authState
  const effectiveStep =
    otpSent && step !== 'name' && step !== 'school'
      ? 'otp'
      : needsOnboarding && step !== 'school'
        ? 'name'
        : step
  const effectiveEmail = needsOnboarding
    ? (authState as { email: string }).email
    : email

  // True when the user already has an auth session but no profile (resume paths).
  const isResume = initialOnboarding || needsOnboarding

  // Defensive reset: whenever onboarding starts, force a fresh school choice.
  useEffect(() => {
    if (initialOnboarding || needsOnboarding) {
      setSelectedSchool(null)
      setSchoolSearchQuery('')
    }
  }, [initialOnboarding, needsOnboarding])

  // Hard-reload to / on sign-in / sign-up / onboarding success. The server
  // actions previously called redirect('/'), but a soft redirect leaves
  // client-only state (e.g. ChatPanelProvider) tied to the prior session.
  // A fresh document load resets everything in one step.
  useEffect(() => {
    if (authState && 'success' in authState) {
      window.location.assign(next ?? '/')
    }
  }, [authState, next])

  useEffect(() => {
    if (onboardingState && 'success' in onboardingState) {
      window.location.assign(next ?? '/welcome')
    }
  }, [onboardingState, next])

  // OTP verified — session cookies are now set. Hard-reload /auth/login so
  // the server detects authed-no-profile and re-renders the form starting
  // at the inline name step. This is what makes the header refresh too.
  useEffect(() => {
    if (otpState && 'needsOnboarding' in otpState) {
      window.location.assign('/auth/login')
    }
  }, [otpState])

  async function handleContinue() {
    if (!email || !EMAIL_REGEX.test(email)) {
      setEmailError('Please enter a valid email address.')
      return
    }
    if (!/\.edu$/i.test(email)) {
      setEmailError('Please use a school email ending in .edu.')
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

  function handleSignUpPasswordContinue() {
    if (password.length < 6) {
      setSignUpPasswordError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setSignUpPasswordError('Passwords do not match.')
      return
    }
    setSignUpPasswordError('')
    setStep('name')
  }

  const passwordError =
    authState && 'error' in authState ? authState.error : null
  const onboardingError =
    onboardingState && 'error' in onboardingState ? onboardingState.error : null
  const otpError =
    otpState && 'error' in otpState ? otpState.error : null
  const otpEmail =
    authState && 'otpSent' in authState ? authState.email : effectiveEmail

  return (
    <main
      data-testid="auth-login-page"
      className="mx-auto flex min-h-screen max-w-sm flex-col px-6 pt-16 pb-12 sm:pt-24"
    >
      <div className="flex flex-col gap-6">
        {effectiveStep === 'email' && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Enter your email
            </h1>

            <div className="flex flex-col gap-1.5">
              <Input
                type="email"
                placeholder="you@school.edu"
                value={email}
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

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {emailExists ? 'Welcome back' : 'Create your password'}
            </h1>

            {emailExists ? (
              // Sign-in: submit directly to the server action at this step
              <form action={formAction} className="flex flex-col gap-4">
                <input type="hidden" name="email" value={email} />
                {next && <input type="hidden" name="next" value={next} />}

                {passwordError && (
                  <p
                    data-testid="auth-form-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {passwordError}
                  </p>
                )}

                <Input
                  name="password"
                  type="password"
                  placeholder="Password"
                  required
                  minLength={6}
                  data-testid="auth-password-input"
                  autoComplete="current-password"
                  className="h-11"
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={authPending}
                  data-testid="auth-signin-button"
                  className="h-11 w-full"
                >
                  {authPending ? '…' : 'Sign In'}
                </Button>

                <Link
                  href="/auth/forgot-password"
                  data-testid="auth-forgot-password-link"
                  className="self-center text-sm underline"
                >
                  Forgot password?
                </Link>
              </form>
            ) : (
              // Sign-up: collect password locally, advance to name on Continue
              <div className="flex flex-col gap-4">
                {signUpPasswordError && (
                  <p
                    data-testid="auth-form-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {signUpPasswordError}
                  </p>
                )}

                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSignUpPasswordContinue()
                    }
                  }}
                  data-testid="auth-password-input"
                  autoComplete="new-password"
                  className="h-11"
                />

                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSignUpPasswordContinue()
                    }
                  }}
                  data-testid="auth-password-confirm-input"
                  autoComplete="new-password"
                  className="h-11"
                />

                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  onClick={handleSignUpPasswordContinue}
                  data-testid="auth-signup-button"
                  className="h-11 w-full"
                >
                  Continue
                </Button>
              </div>
            )}
          </>
        )}

        {effectiveStep === 'otp' && (
          <>
            {otpError && (
              <p
                data-testid="auth-form-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {otpError}
              </p>
            )}

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Check your email
            </h1>
            <p data-testid="auth-otp-instructions" className="text-base text-muted-foreground">
              We sent a 6-digit code to{' '}
              <span className="text-foreground">{otpEmail}</span>.
              Enter it below to finish creating your account.
            </p>

            <form action={otpAction} className="flex flex-col gap-4">
              <input type="hidden" name="email" value={otpEmail} />

              <Input
                name="token"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123456"
                required
                autoFocus
                autoComplete="one-time-code"
                data-testid="auth-otp-input"
                className="h-11 text-center text-lg tracking-[0.4em]"
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={otpPending}
                data-testid="auth-otp-verify-button"
                className="h-11 w-full"
              >
                {otpPending ? '…' : 'Verify code'}
              </Button>

              <ResendCodeButton
                onResend={() => resendSignupOtp(otpEmail)}
                testId="auth-otp-resend-button"
              />
            </form>
          </>
        )}

        {effectiveStep === 'name' && (
          <>
            {!isResume && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep('password')}
                data-testid="auth-back-button"
                className="-ml-2 self-start"
              >
                ← Back
              </Button>
            )}

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

            {(isResume ? onboardingError : passwordError) && (
              <p
                data-testid="auth-form-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {isResume ? onboardingError : passwordError}
              </p>
            )}

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Where do you go to school?
            </h1>

            {/*
              Resume path (initialOnboarding / needsOnboarding): user has a session,
              submit to completeOnboarding which reads the authenticated user from cookies.
              Fresh sign-up path: no session yet, submit all collected data to authenticate
              which calls signUp with full_name + school_id stored in user_metadata.
            */}
            <form
              action={isResume ? onboardingAction : formAction}
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="full_name" value={fullName} />
              {!isResume && (
                <>
                  <input type="hidden" name="email" value={email} />
                  <input type="hidden" name="password" value={password} />
                  <input type="hidden" name="confirm_password" value={confirmPassword} />
                  {next && <input type="hidden" name="next" value={next} />}
                </>
              )}

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
                disabled={(isResume ? onboardingPending : authPending) || !selectedSchool}
                data-testid="auth-onboarding-complete-button"
                className="h-11 w-full"
              >
                {(isResume ? onboardingPending : authPending) ? '…' : 'Get Started'}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
