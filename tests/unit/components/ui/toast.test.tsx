/**
 * @file toast.test.tsx
 * @description Render tests for the Toast primitive — provider mounts, useToast() shows + auto-dismisses.
 *   Called by: Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ToastProvider, useToast } from '@/components/ui/toast'

function Trigger({ message, duration }: { message: string; duration?: number }) {
  const { toast } = useToast()
  return (
    <button onClick={() => toast(message, duration ? { duration } : undefined)}>
      fire
    </button>
  )
}

describe('<ToastProvider /> + useToast()', () => {
  it('mounts the toast container with the catalog testid', () => {
    render(
      <ToastProvider>
        <Trigger message="hello" />
      </ToastProvider>
    )
    expect(screen.getByTestId('toast-container')).toBeInTheDocument()
  })

  it('shows a toast on invocation and auto-dismisses after duration', async () => {
    render(
      <ToastProvider>
        <Trigger message="boom" duration={50} />
      </ToastProvider>
    )

    expect(screen.queryByText('boom')).toBeNull()

    fireEvent.click(screen.getByText('fire'))
    expect(screen.getByText('boom')).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByText('boom')).toBeNull(), {
      timeout: 500,
    })
  })

  it('throws when useToast is called outside ToastProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Trigger message="x" />)).toThrow(/ToastProvider/i)
    spy.mockRestore()
  })
})
