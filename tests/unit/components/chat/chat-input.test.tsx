/**
 * @file chat-input.test.tsx
 * @description Unit tests for the ChatInput component.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from '@/components/chat/chat-input'

const ORDER_ID = '00000000-0000-4000-8000-000000000002'

const mockFetch = vi.fn()

describe('ChatInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a textarea and send button', () => {
    render(<ChatInput orderId={ORDER_ID} onSend={vi.fn()} disabled={false} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
  })

  it('send button is disabled when textarea is empty', () => {
    render(<ChatInput orderId={ORDER_ID} onSend={vi.fn()} disabled={false} />)
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
  })

  it('calls onSend with trimmed text when Enter is pressed', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<ChatInput orderId={ORDER_ID} onSend={onSend} disabled={false} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'hello world')
    await user.keyboard('{Enter}')

    expect(onSend).toHaveBeenCalledWith('hello world')
  })

  it('clears textarea after successful send', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<ChatInput orderId={ORDER_ID} onSend={onSend} disabled={false} />)

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
    render(<ChatInput orderId={ORDER_ID} onSend={onSend} disabled={false} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'hello')
    await user.keyboard('{Shift>}{Enter}{/Shift}')

    expect(onSend).not.toHaveBeenCalled()
  })

  it('shows error message when onSend throws', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn().mockRejectedValue(new Error('Failed to send message'))
    render(<ChatInput orderId={ORDER_ID} onSend={onSend} disabled={false} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'hello')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByText('Failed to send message')).toBeInTheDocument()
    })
  })

  it('disables textarea and buttons when disabled prop is true', () => {
    render(<ChatInput orderId={ORDER_ID} onSend={vi.fn()} disabled={true} />)
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /upload delivery photo/i })).toBeDisabled()
  })

  it('shows "Conversation closed" placeholder when disabled', () => {
    render(<ChatInput orderId={ORDER_ID} onSend={vi.fn()} disabled={true} />)
    expect(screen.getByPlaceholderText('Conversation closed')).toBeInTheDocument()
  })

  it('renders a camera/upload button', () => {
    render(<ChatInput orderId={ORDER_ID} onSend={vi.fn()} disabled={false} />)
    expect(screen.getByRole('button', { name: /upload delivery photo/i })).toBeInTheDocument()
  })

  it('calls upload endpoint with FormData on file selection', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: 'msg-photo' }),
    })

    render(<ChatInput orderId={ORDER_ID} onSend={vi.fn()} disabled={false} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })

    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/messages/${ORDER_ID}/upload`,
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('shows upload error message on failed upload', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Only the swiper can upload delivery photos' }),
    })

    render(<ChatInput orderId={ORDER_ID} onSend={vi.fn()} disabled={false} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })

    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(
        screen.getByText('Only the swiper can upload delivery photos')
      ).toBeInTheDocument()
    })
  })
})
