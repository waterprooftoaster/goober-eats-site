'use client'

/**
 * @file login-form.tsx
 * @description Multi-step login/sign-up form. Sign-up collects every field
 *   (email → password → name → school) BEFORE the OTP is sent, so users can
 *   freely back up and edit any prior step until they trigger the code.
 *   Sign-in stays a two-step flow (email → password). Errors render inline
 *   (role="alert"), never as toasts.
 *   Called by: app/auth/login/page.tsx
 * @dependencies app/auth/actions.ts, components/ui/{button,input,combobox}
 */

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import {
  authenticate,
  completeOnboarding,
  resendSignupOtp,
  signUpStart,
  verifySignupOtp,
} from '@/app/auth/actions'
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
}

type Step = 'email' | 'password' | 'name' | 'school' | 'otp'

/**
 * Renders the multi-step authentication form. Sign-up walks
 * email → password → name → school → otp; sign-in is email → password.
 * @param schools - Available schools for the school-selection step
 * @param initialOnboarding - Start at the name step (returning user
 *   without a profile) and submit through completeOnboarding instead of
 *   signUpStart
 * @param userEmail - Pre-fill the email field (used during onboarding resume)
 * @returns Multi-step auth/onboarding form
 * @called-by app/auth/login/page.tsx
 */
export function LoginForm({
  schools,
  initialOnboarding,
  userEmail,
}: LoginFormProps) {
  const [step, setStep] = useState<Step>(initialOnboarding ? 'name' : 'email')
  const [email, setEmail] = useState(userEmail ?? '')
  const [emailError, setEmailError] = useState('')
  const [emailExists, setEmailExists] = useState<boolean | null>(null)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLocalError, setPasswordLocalError] = useState('')
  const [fullName, setFullName] = useState('')
  const [selectedSchool, setSelectedSchool] = useState<{ value: string; label: string } | null>(
    null,
  )
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('')

  const [signinState, signinAction, signinPending] = useActionState(authenticate, null)
  const [signupState, signupAction, signupPending] = useActionState(signUpStart, null)
  const [otpState, otpAction, otpPending] = useActionState(verifySignupOtp, null)
  const [onboardingState, onboardingAction, onboardingPending] = useActionState(
    completeOnboarding,
    null,
  )

  // Sign-in returned needsOnboarding (returning user without a profile);
  // route the form into the resume path's name step.
  const signinNeedsOnboarding = !!signinState && 'needsOnboarding' in signinState
  // Sign-up succeeded server-side and the OTP email is on its way.
  const otpSent = !!signupState && 'otpSent' in signupState
  // OTP step accepted the code but client lost name/school — fall back to
  // the resume onboarding step.
  const otpNeedsOnboarding = !!otpState && 'needsOnboarding' in otpState

  const effectiveStep: Step =
    otpSent && step !== 'otp'
      ? 'otp'
      : signinNeedsOnboarding && step !== 'school'
        ? 'name'
        : otpNeedsOnboarding && step !== 'school'
          ? 'name'
          : step

  // Hard-reload to / on success so SSR re-resolves the principal and the
  // chat / Realtime providers tear down with the prior session.
  useEffect(() => {
    if (signinState && 'success' in signinState) window.location.assign('/')
  }, [signinState])

  useEffect(() => {
    if (signupState && 'success' in signupState) window.location.assign('/')
  }, [signupState])

  useEffect(() => {
    if (otpState && 'success' in otpState) window.location.assign('/')
  }, [otpState])

  useEffect(() => {
    if (onboardingState && 'success' in onboardingState) window.location.assign('/')
  }, [onboardingState])

  // When otpSent flips true, advance the step (so subsequent renders no
  // longer depend on signupState being otpSent — back navigation works).
  useEffect(() => {
    if (otpSent) setStep('otp')
  }, [otpSent])

  // Defensive reset whenever onboarding starts.
  useEffect(() => {
    if (initialOnboarding) {
      setSelectedSchool(null)
      setSchoolSearchQuery('')
    }
  }, [initialOnboarding])

  async function handleEmailContinue() {
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
      const res = await fetch('/api/auth/check-email?email=' + encodeURIComponent(email))
      const body = await res.json()
      setEmailExists(body.exists ?? false)
    } catch {
      setEmailExists(false)
    }
    setCheckingEmail(false)
    setStep('password')
  }

  function handlePasswordContinue() {
    setPasswordLocalError('')
    if (!password || password.length < 6) {
      setPasswordLocalError('Password must be at least 6 characters.')
      return
    }
    if (confirmPassword !== password) {
      setPasswordLocalError('Passwords do not match.')
      return
    }
    setStep('name')
  }

  const signinError = signinState && 'error' in signinState ? signinState.error : null
  const signupError = signupState && 'error' in signupState ? signupState.error : null
  const otpError = otpState && 'error' in otpState ? otpState.error : null
  const onboardingError =
    onboardingState && 'error' in onboardingState ? onboardingState.error : null

  // The resume path posts to completeOnboarding; the primary signup path
  // posts to signUpStart with the password we collected earlier.
  const onSchoolSubmit = initialOnboarding || signinNeedsOnboarding || otpNeedsOnboarding
  const schoolFormAction = onSchoolSubmit ? onboardingAction : signupAction
  const schoolPending = onSchoolSubmit ? onboardingPending : signupPending

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
                    handleEmailContinue()
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
              onClick={handleEmailContinue}
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

            {(signinError || passwordLocalError) && (
              <p
                data-testid="auth-form-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {signinError ?? passwordLocalError}
              </p>
            )}

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {emailExists ? 'Welcome back' : 'Create your password'}
            </h1>

            {emailExists ? (
              <form action={signinAction} className="flex flex-col gap-4">
                <input type="hidden" name="email" value={email} />

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
                  disabled={signinPending}
                  data-testid="auth-signin-button"
                  className="h-11 w-full"
                >
                  {signinPending ? '…' : 'Sign In'}
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
              <div className="flex flex-col gap-4">
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
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
                      handlePasswordContinue()
                    }
                  }}
                  minLength={6}
                  data-testid="auth-password-confirm-input"
                  autoComplete="new-password"
                  className="h-11"
                />

                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  onClick={handlePasswordContinue}
                  disabled={!password || !confirmPassword}
                  data-testid="auth-password-continue-button"
                  className="h-11 w-full"
                >
                  Continue
                </Button>
              </div>
            )}
          </>
        )}

        {effectiveStep === 'name' && (
          <>
            {!initialOnboarding && (
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

            {(signupError || onboardingError) && (
              <p
                data-testid="auth-form-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {signupError ?? onboardingError}
              </p>
            )}

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Where do you go to school?
            </h1>

            <form action={schoolFormAction} className="flex flex-col gap-4">
              {!onSchoolSubmit && (
                <>
                  <input type="hidden" name="email" value={email} />
                  <input type="hidden" name="password" value={password} />
                  <input type="hidden" name="confirm_password" value={confirmPassword} />
                </>
              )}
              <input type="hidden" name="full_name" value={fullName} />
              <input type="hidden" name="school_id" value={selectedSchool?.value ?? ''} />

              <div data-testid="auth-school-input">
                <Combobox
                  value={selectedSchool}
                  onValueChange={(value) =>
                    setSelectedSchool(value as { value: string; label: string } | null)
                  }
                  onInputValueChange={(inputValue) => setSchoolSearchQuery(inputValue)}
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

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={schoolPending || !selectedSchool}
                data-testid="auth-onboarding-complete-button"
                className="h-11 w-full"
              >
                {schoolPending ? '…' : onSchoolSubmit ? 'Get Started' : 'Send code'}
              </Button>
            </form>
          </>
        )}

        {effectiveStep === 'otp' && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep('school')}
              data-testid="auth-back-button"
              className="-ml-2 self-start"
            >
              ← Back
            </Button>

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
            <p
              data-testid="auth-otp-instructions"
              className="text-base text-muted-foreground"
            >
              We sent a 6-digit code to{' '}
              <span className="text-foreground">{email}</span>. Enter it below to finish
              creating your account.
            </p>

            <form action={otpAction} className="flex flex-col gap-4">
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="full_name" value={fullName} />
              <input type="hidden" name="school_id" value={selectedSchool?.value ?? ''} />

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
                onResend={() => resendSignupOtp(email)}
                testId="auth-otp-resend-button"
              />
            </form>
          </>
        )}
      </div>
    </main>
  )
}
