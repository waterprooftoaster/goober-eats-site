/**
 * @file completion-banner.test.tsx
 * @description Unit tests for the CompletionBanner component shown to swipers after order completion.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CompletionBanner } from '@/components/chat/completion-banner'

const ORDER_ID = '00000000-0000-4000-8000-000000000099'

const mockFetch = vi.fn()

function mockOk(body: unknown = {}) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  })
}

function mockErr(status: number, body: unknown = {}) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('CompletionBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders Complete Order and Unaccept buttons', () => {
    render(<CompletionBanner orderId={ORDER_ID} />)
    expect(screen.getByRole('button', { name: 'Complete Order' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unaccept' })).toBeInTheDocument()
  })

  it('clicking Unaccept fires PATCH with { status: "open" }', async () => {
    const user = userEvent.setup()
    mockFetch.mockReturnValue(mockOk())
    render(<CompletionBanner orderId={ORDER_ID} />)

    await user.click(screen.getByRole('button', { name: 'Unaccept' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/orders/${ORDER_ID}/status`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'open' }),
        })
      )
    })
  })

  it('shows loading state while Unaccept request is in flight', async () => {
    const user = userEvent.setup()
    mockFetch.mockReturnValue(new Promise(() => {}))
    render(<CompletionBanner orderId={ORDER_ID} />)

    await user.click(screen.getByRole('button', { name: 'Unaccept' }))

    await waitFor(() => {
      expect(screen.getByText('Unaccepting…')).toBeInTheDocument()
    })
  })

  it('hides the banner on successful Unaccept', async () => {
    const user = userEvent.setup()
    mockFetch.mockReturnValue(mockOk())
    render(<CompletionBanner orderId={ORDER_ID} />)

    await user.click(screen.getByRole('button', { name: 'Unaccept' }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Complete Order' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Unaccept' })).not.toBeInTheDocument()
    })
  })

  it('shows error message when Unaccept fails', async () => {
    const user = userEvent.setup()
    mockFetch.mockReturnValue(mockErr(409, { error: 'Order already unaccepted' }))
    render(<CompletionBanner orderId={ORDER_ID} />)

    await user.click(screen.getByRole('button', { name: 'Unaccept' }))

    await waitFor(() => {
      expect(screen.getByText('Order already unaccepted')).toBeInTheDocument()
    })
  })

  it('calls onStatusChange("completed") on successful completion', async () => {
    const user = userEvent.setup()
    const onStatusChange = vi.fn()
    // First call: upload; second call: status PATCH
    mockFetch
      .mockReturnValueOnce(mockOk())
      .mockReturnValueOnce(mockOk())
    render(<CompletionBanner orderId={ORDER_ID} onStatusChange={onStatusChange} />)

    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith('completed')
    })
  })

  it('does not call onStatusChange when status PATCH fails', async () => {
    const user = userEvent.setup()
    const onStatusChange = vi.fn()
    mockFetch
      .mockReturnValueOnce(mockOk())
      .mockReturnValueOnce(mockErr(409, { error: 'Cannot complete order' }))
    render(<CompletionBanner orderId={ORDER_ID} onStatusChange={onStatusChange} />)

    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() => {
      expect(screen.getByText('Cannot complete order')).toBeInTheDocument()
    })
    expect(onStatusChange).not.toHaveBeenCalled()
  })
})
