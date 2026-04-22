/**
 * @file order-new-page.test.tsx
 * @description Unit tests for OrderNewForm component (the client form on /order/new).
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={(props.alt as string) ?? ''} />
  ),
}))

// Stub Stripe EmbeddedCheckoutProvider so it doesn't need a real Stripe instance
vi.mock('@stripe/react-stripe-js', () => ({
  EmbeddedCheckoutProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="stripe-checkout">{children}</div>
  ),
  EmbeddedCheckout: () => <div data-testid="embedded-checkout" />,
}))

const { OrderNewForm } = await import('@/app/order/new/order-new-form')

const VERBATIM_COPY =
  'Upload the entire cart including the subtotal. If the total you enter doesn\'t match the subtotal in your screenshots, a swiper probably won\'t accept your order.'

let mockFetch: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockFetch = vi.fn()
  vi.stubGlobal('fetch', mockFetch)
  // Mock URL.createObjectURL for file previews
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('OrderNewForm', () => {
  it('renders the restaurant name input', () => {
    render(<OrderNewForm isGuest={false} />)
    expect(screen.getByPlaceholderText(/restaurant/i)).toBeInTheDocument()
  })

  it('renders the ScreenshotUploader trigger button', () => {
    render(<OrderNewForm isGuest={false} />)
    expect(screen.getByRole('button', { name: /upload screenshots/i })).toBeInTheDocument()
  })

  it('renders the TotalInput field', () => {
    render(<OrderNewForm isGuest={false} />)
    expect(screen.getByRole('textbox', { name: /total/i })).toBeInTheDocument()
  })

  it('renders the verbatim reminder copy', () => {
    render(<OrderNewForm isGuest={false} />)
    expect(screen.getByText(VERBATIM_COPY)).toBeInTheDocument()
  })

  it('submit button is disabled when restaurant name is empty', () => {
    render(<OrderNewForm isGuest={false} />)
    expect(screen.getByRole('button', { name: /place order/i })).toBeDisabled()
  })

  it('submit button is disabled when no screenshots are present', async () => {
    const user = userEvent.setup()
    render(<OrderNewForm isGuest={false} />)
    await user.type(screen.getByPlaceholderText(/restaurant/i), 'Chipotle')
    expect(screen.getByRole('button', { name: /place order/i })).toBeDisabled()
  })

  it('submit button is disabled when total is missing', async () => {
    const user = userEvent.setup()
    render(<OrderNewForm isGuest={false} />)
    await user.type(screen.getByPlaceholderText(/restaurant/i), 'Chipotle')
    // No file upload, no total — submit still disabled
    expect(screen.getByRole('button', { name: /place order/i })).toBeDisabled()
  })

  it('shows a guest name field when isGuest=true', () => {
    render(<OrderNewForm isGuest={true} />)
    expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument()
  })

  it('does not show a guest name field when isGuest=false', () => {
    render(<OrderNewForm isGuest={false} />)
    expect(screen.queryByPlaceholderText(/your name/i)).toBeNull()
  })

  it('calls sign-upload endpoint then checkout-session on valid submit', async () => {
    const user = userEvent.setup()

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ signed_url: 'https://storage.example.com/sign', path: 'cart-screenshots/test.jpg' }),
      })
      .mockResolvedValueOnce({ ok: true })  // PUT to signed URL
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clientSecret: 'cs_test_123' }),
      })

    render(<OrderNewForm isGuest={false} />)

    await user.type(screen.getByPlaceholderText(/restaurant/i), 'Chipotle')

    // Simulate uploading a file via the hidden input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'cart.jpg', { type: 'image/jpeg' })
    await user.upload(fileInput, file)

    // Set total via the total input
    const totalInput = screen.getByRole('textbox', { name: /total/i })
    await user.click(totalInput)
    await user.type(totalInput, '15.00')
    totalInput.blur()

    await user.click(screen.getByRole('button', { name: /place order/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/cart-screenshots/sign-upload',
        expect.objectContaining({ method: 'POST' })
      )
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/stripe/checkout-session',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('shows an error message and does not proceed when sign-upload fails', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Upload failed' }),
    })

    render(<OrderNewForm isGuest={false} />)

    await user.type(screen.getByPlaceholderText(/restaurant/i), 'Chipotle')
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, new File(['x'], 'cart.jpg', { type: 'image/jpeg' }))
    const totalInput = screen.getByRole('textbox', { name: /total/i })
    await user.click(totalInput)
    await user.type(totalInput, '15.00')
    totalInput.blur()

    await user.click(screen.getByRole('button', { name: /place order/i }))

    // "Upload failed" appears in both the file entry and the form error area — check either exists
    await waitFor(() => {
      expect(screen.getAllByText(/upload failed|failed to upload/i).length).toBeGreaterThan(0)
    })

    expect(mockFetch).not.toHaveBeenCalledWith('/api/stripe/checkout-session', expect.anything())
  })
})
