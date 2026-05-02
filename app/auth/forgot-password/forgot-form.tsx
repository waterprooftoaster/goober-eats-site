'use client'

/**
 * @file forgot-form.tsx
 * @description Email-input form that triggers the requestPasswordReset
 *   server action. Renders one of two states: the input form, or a
 *   "check your email" panel after a successful submission.
 *   Called by: app/auth/forgot-password/page.tsx
 * @dependencies app/auth/forgot-password/actions.ts, components/ui/{button,input}
 */

import Link from 'next/link'
import { useActionState } from 'react'
import { requestPasswordReset } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Renders the forgot-password form; switches to a confirmation panel on success.
 * @returns Email-input form or post-submit confirmation panel
 * @called-by app/auth/forgot-password/page.tsx
 */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, null)

  if (state && 'sent' in state) {
    return (
      <main
        data-testid="forgot-password-page"
        className="mx-auto flex min-h-screen max-w-sm flex-col px-6 pt-16 pb-12 sm:pt-24"
      >
        <div className="flex flex-col gap-6">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Check your email
          </h1>
          <p data-testid="forgot-password-sent" className="text-base text-muted-foreground">
            We sent a password reset link to{' '}
            <span className="text-foreground">{state.email}</span>. Open it
            on this device to set a new password.
          </p>
          <Link
            href="/auth/login"
            data-testid="forgot-password-back-to-login"
            className="text-sm underline"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    )
  }

  const error = state && 'error' in state ? state.error : null

  return (
    <main
      data-testid="forgot-password-page"
      className="mx-auto flex min-h-screen max-w-sm flex-col px-6 pt-16 pb-12 sm:pt-24"
    >
      <div className="flex flex-col gap-6">
        {error && (
          <p
            data-testid="forgot-password-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Reset your password
        </h1>
        <p className="text-base text-muted-foreground">
          Enter the email you signed up with and we&apos;ll send a reset link.
        </p>

        <form action={formAction} className="flex flex-col gap-4">
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
            disabled={pending}
            data-testid="forgot-password-submit-button"
            className="h-11 w-full"
          >
            {pending ? '…' : 'Send reset link'}
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
