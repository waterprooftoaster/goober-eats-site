/**
 * @file header-cart-button.test.tsx
 * @description Unit tests for the HeaderCartButton component (cart count badge in the header).
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { HeaderCartButton } from '@/components/header-cart-button'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}))

const mockFetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  // Reset pathname to default after each test to prevent state leaking
  vi.mocked(usePathname).mockReturnValue('/')
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fireCartUpdated() {
  window.dispatchEvent(new CustomEvent('cart-updated'))
}

function mockCountResponse(count: number) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ count }),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('HeaderCartButton', () => {
  it('renders badge with initial itemCount prop', () => {
    render(<HeaderCartButton itemCount={3} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders no badge when itemCount is 0', () => {
    render(<HeaderCartButton itemCount={0} />)
    // Badge span should not be present
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('displays 99+ when itemCount is 100', () => {
    render(<HeaderCartButton itemCount={100} />)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('returns null on checkout path', () => {
    vi.mocked(usePathname).mockReturnValue('/checkout/payment')
    const { container } = render(<HeaderCartButton itemCount={2} />)
    expect(container.firstChild).toBeNull()
  })

  it('fetches /api/cart/count and updates badge when cart-updated event fires', async () => {
    mockCountResponse(7)
    render(<HeaderCartButton itemCount={2} />)

    fireCartUpdated()

    await waitFor(() => expect(screen.getByText('7')).toBeInTheDocument())
    expect(mockFetch).toHaveBeenCalledWith('/api/cart/count')
  })

  it('removes badge when count API returns 0', async () => {
    mockCountResponse(0)
    render(<HeaderCartButton itemCount={3} />)
    expect(screen.getByText('3')).toBeInTheDocument()

    fireCartUpdated()

    await waitFor(() => expect(screen.queryByText('3')).not.toBeInTheDocument())
  })

  it('keeps existing count when fetch throws (network error)', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))
    render(<HeaderCartButton itemCount={2} />)

    fireCartUpdated()

    // Should not crash and badge should remain unchanged
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('removes event listener on unmount — no state update after unmount', async () => {
    mockCountResponse(5)
    const { unmount } = render(<HeaderCartButton itemCount={2} />)

    unmount()
    fireCartUpdated()

    // After unmount the listener is gone — fetch should not be called
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
