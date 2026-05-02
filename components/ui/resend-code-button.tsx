'use client'

/**
 * @file resend-code-button.tsx
 * @description Cooldown-gated "Resend code" button. Disabled and shows a
 *   countdown ("Resend in 20s") until the timer hits zero, then becomes
 *   clickable. Each click invokes `onResend` and restarts the cooldown.
 *   Called by: app/auth/login/login-form.tsx,
 *     app/auth/forgot-password/forgot-form.tsx
 * @dependencies components/ui/button
 */

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'

interface ResendCodeButtonProps {
  onResend: () => void | Promise<void>
  cooldownSeconds?: number
  testId?: string
}

/**
 * Renders a "Resend code" button that locks for `cooldownSeconds` after each
 * click. Mounts in the cooled-down state so the user cannot spam-resend the
 * code that just arrived.
 * @param onResend - Action to invoke when the button is clicked
 * @param cooldownSeconds - Lockout window in seconds (default: 20)
 * @param testId - Optional data-testid for E2E selectors
 * @returns Button that disables itself for the cooldown window
 * @called-by ForgotPasswordForm, LoginForm
 */
export function ResendCodeButton({
  onResend,
  cooldownSeconds = 20,
  testId,
}: ResendCodeButtonProps) {
  const [secondsLeft, setSecondsLeft] = useState(cooldownSeconds)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [secondsLeft])

  const locked = secondsLeft > 0 || isPending
  const label = locked
    ? isPending
      ? 'Sending…'
      : `Resend in ${secondsLeft}s`
    : 'Resend code'

  function handleClick() {
    if (locked) return
    startTransition(async () => {
      await onResend()
      setSecondsLeft(cooldownSeconds)
    })
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={locked}
      onClick={handleClick}
      data-testid={testId}
      className="self-center text-sm"
    >
      {label}
    </Button>
  )
}
