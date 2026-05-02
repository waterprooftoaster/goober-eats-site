'use client'

/**
 * @file reset-form.tsx
 * @description Single-field password form that calls resetPassword.
 *   Hard-reloads to /auth/login on success so the freshly-set password is
 *   the credential used for sign-in (the recovery session is no longer
 *   needed).
 *   Called by: app/auth/reset-password/page.tsx
 * @dependencies app/auth/reset-password/actions.ts, components/ui/{button,input}
 */

import { useActionState, useEffect } from 'react'
import { resetPassword } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Renders the new-password form; redirects to /auth/login on success.
 * @returns Single-field password form
 * @called-by app/auth/reset-password/page.tsx
 */
export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPassword, null)

  useEffect(() => {
    if (state && 'success' in state) {
      window.location.assign('/auth/login')
    }
  }, [state])

  const error = state && 'error' in state ? state.error : null

  return (
    <main
      data-testid="reset-password-page"
      className="mx-auto flex min-h-screen max-w-sm flex-col px-6 pt-16 pb-12 sm:pt-24"
    >
      <div className="flex flex-col gap-6">
        {error && (
          <p
            data-testid="reset-password-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Set a new password
        </h1>

        <form action={formAction} className="flex flex-col gap-4">
          <Input
            name="password"
            type="password"
            placeholder="New password (min 8 characters)"
            required
            minLength={8}
            data-testid="reset-password-input"
            autoComplete="new-password"
            className="h-11"
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={pending}
            data-testid="reset-password-submit-button"
            className="h-11 w-full"
          >
            {pending ? '…' : 'Update password'}
          </Button>
        </form>
      </div>
    </main>
  )
}
