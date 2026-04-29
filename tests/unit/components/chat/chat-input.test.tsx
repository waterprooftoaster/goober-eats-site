/**
 * @file chat-input.test.tsx
 * @description Unit tests for the ChatInput component.
 *   Called by: Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from '@/components/chat/chat-input'

describe('ChatInput', () => {
  it('renders a textarea and send button', () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
  })

  it('send button is disabled when textarea is empty', () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} />)
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
  })

  it('calls onSend with trimmed text when Enter is pressed', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<ChatInput onSend={onSend} disabled={false} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'hello world')
    await user.keyboard('{Enter}')

    expect(onSend).toHaveBeenCalledWith('hello world')
  })

  it('clears textarea after successful send', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<ChatInput onSend={onSend} disabled={false} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'hello')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(textarea).toHaveValue('')
    })
  })

  it('does not call onSend on Shift+Enter', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} disabled={false} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'hello')
    await user.keyboard('{Shift>}{Enter}{/Shift}')

    expect(onSend).not.toHaveBeenCalled()
  })

  it('shows error message when onSend throws', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn().mockRejectedValue(new Error('Failed to send message'))
    render(<ChatInput onSend={onSend} disabled={false} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'hello')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByText('Failed to send message')).toBeInTheDocument()
    })
  })

  it('disables textarea and send button when disabled prop is true', () => {
    render(<ChatInput onSend={vi.fn()} disabled={true} />)
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
  })

  it('shows "Conversation closed" placeholder when disabled', () => {
    render(<ChatInput onSend={vi.fn()} disabled={true} />)
    expect(screen.getByPlaceholderText('Conversation closed')).toBeInTheDocument()
  })

  it('does not render a camera/upload button', () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} />)
    expect(screen.queryByRole('button', { name: /upload completion photo/i })).not.toBeInTheDocument()
    expect(document.querySelector('input[type="file"]')).toBeNull()
  })
})
