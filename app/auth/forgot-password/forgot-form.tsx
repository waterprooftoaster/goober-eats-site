'use client'

/**
 * @file forgot-form.tsx
 * @description Two-step forgot-password form: email entry → 6-digit OTP entry.
 *   On OTP success the recovery session is established in this same tab
 *   and we hard-load /auth/reset-password to render the new-password form.
 *   Called by: app/auth/forgot-password/page.tsx
 * @dependencies app/auth/forgot-password/actions.ts, components/ui/{button,input}
 */

import Link from 'next/link'
import { useActionState, useEffect } from 'react'
import { requestPasswordReset, resendRecoveryOtp, verifyRecoveryOtp } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ResendCodeButton } from '@/components/ui/resend-code-button'

/**
 * Renders the forgot-password form: request reset, then verify OTP.
 * @returns Email-input form, OTP-input form, or post-verification redirect
 * @called-by app/auth/forgot-password/page.tsx
 */
export function ForgotPasswordForm() {
  const [requestState, requestAction, requestPending] = useActionState(requestPasswordReset, null)
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyRecoveryOtp, null)

  // OTP verified — recovery session is set; hard-load the reset-password
  // page so the server picks up the new session and renders the password
  // form.
  useEffect(() => {
    if (verifyState && 'success' in verifyState) {
      window.location.assign('/auth/reset-password')
    }
  }, [verifyState])

  const sentEmail =
    requestState && 'sent' in requestState ? requestState.email : null
  const verifyError =
    verifyState && 'error' in verifyState ? verifyState.error : null
  const requestError =
    requestState && 'error' in requestState ? requestState.error : null

  if (sentEmail) {
    return (
      <main
        data-testid="forgot-password-page"
        className="mx-auto flex min-h-screen max-w-sm flex-col px-6 pt-16 pb-12 sm:pt-24"
      >
        <div className="flex flex-col gap-6">
          {verifyError && (
            <p
              data-testid="forgot-password-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {verifyError}
            </p>
          )}

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Check your email
          </h1>
          <p data-testid="forgot-password-sent" className="text-base text-muted-foreground">
            We sent a 6-digit code to{' '}
            <span className="text-foreground">{sentEmail}</span>. Enter it below
            to set a new password.
          </p>

          <form action={verifyAction} className="flex flex-col gap-4">
            <input type="hidden" name="email" value={sentEmail} />

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
              data-testid="forgot-password-otp-input"
              className="h-11 text-center text-lg tracking-[0.4em]"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={verifyPending}
              data-testid="forgot-password-verify-button"
              className="h-11 w-full"
            >
              {verifyPending ? '…' : 'Verify code'}
            </Button>

            <ResendCodeButton
              onResend={() => resendRecoveryOtp(sentEmail)}
              testId="forgot-password-resend-button"
            />

            <Link
              href="/auth/login"
              data-testid="forgot-password-back-to-login"
              className="self-center text-sm underline"
            >
              Back to sign in
            </Link>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main
      data-testid="forgot-password-page"
      className="mx-auto flex min-h-screen max-w-sm flex-col px-6 pt-16 pb-12 sm:pt-24"
    >
      <div className="flex flex-col gap-6">
        {requestError && (
          <p
            data-testid="forgot-password-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {requestError}
          </p>
        )}

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Reset your password
        </h1>
        <p className="text-base text-muted-foreground">
          Enter the email you signed up with and we&apos;ll send a 6-digit code.
        </p>

        <form action={requestAction} className="flex flex-col gap-4">
          <Input
            name="email"
            type="email"
            placeholder="you@school.edu"
            required
            data-testid="forgot-password-email-input"
            autoComplete="email"
            className="h-11"
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={requestPending}
            data-testid="forgot-password-submit-button"
            className="h-11 w-full"
          >
            {requestPending ? '…' : 'Send reset code'}
          </Button>

          <Link
            href="/auth/login"
            className="self-center text-sm underline"
          >
            Back to sign in
          </Link>
        </form>
      </div>
    </main>
  )
}
