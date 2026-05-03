/**
 * @file resend-code-button.test.tsx
 * @description Unit tests for the cooldown-gated resend button: it must
 *   start disabled, count down to zero, fire the action on click, and
 *   reset the lockout afterward.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { ResendCodeButton } from '@/components/ui/resend-code-button'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ResendCodeButton', () => {
  it('mounts disabled, counting down from the cooldown', () => {
    render(<ResendCodeButton onResend={() => {}} cooldownSeconds={20} />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Resend in 20s')
  })

  it('decrements the counter once per second', () => {
    render(<ResendCodeButton onResend={() => {}} cooldownSeconds={3} />)
    const button = screen.getByRole('button')
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(button).toHaveTextContent('Resend in 2s')
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(button).toBeEnabled()
    expect(button).toHaveTextContent('Resend code')
  })

  it('fires onResend when clicked once unlocked, then re-locks', async () => {
    const onResend = vi.fn().mockResolvedValue(undefined)
    render(<ResendCodeButton onResend={onResend} cooldownSeconds={5} />)
    const button = screen.getByRole('button')

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(button).toBeEnabled()

    await act(async () => {
      fireEvent.click(button)
      // Flush the startTransition-wrapped promise resolution so the
      // post-click setSecondsLeft(cooldown) runs before assertions.
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onResend).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Resend in 5s')
  })

  it('does nothing on click while still locked', () => {
    const onResend = vi.fn()
    render(<ResendCodeButton onResend={onResend} cooldownSeconds={5} />)
    const button = screen.getByRole('button')

    fireEvent.click(button)
    expect(onResend).not.toHaveBeenCalled()
  })
})
