/**
 * @file cart-panel.test.tsx
 * @description Unit tests for the CartPanel component.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { LoadedCart } from '@/lib/cart/load'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ back: vi.fn() })),
}))

const mockFetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------
import { CartPanel } from '@/components/cart-panel'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeCart(): LoadedCart {
  return {
    id: 'cart-1',
    eatery_id: 'eatery-1',
    eatery_name: 'Test Eatery',
    items: [
      {
        id: 'item-1',
        menu_item_id: 'mi-1',
        name: 'Burger',
        quantity: 1,
        price_cents: 1000,
        image_url: null,
        selected_options: [],
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('CartPanel — cart-updated event dispatch', () => {
  it('dispatches cart-updated on window after successful item removal', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({ ok: true })

    const handler = vi.fn()
    window.addEventListener('cart-updated', handler)

    render(<CartPanel initialCart={makeCart()} />)
    await user.click(screen.getByRole('button', { name: 'Remove Burger' }))

    await waitFor(() => expect(handler).toHaveBeenCalledTimes(1))

    window.removeEventListener('cart-updated', handler)
  })

  it('does NOT dispatch cart-updated when DELETE returns non-ok', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({ ok: false })

    const handler = vi.fn()
    window.addEventListener('cart-updated', handler)

    render(<CartPanel initialCart={makeCart()} />)
    await user.click(screen.getByRole('button', { name: 'Remove Burger' }))

    await waitFor(() =>
      expect(screen.getByText('Failed to remove item — please try again')).toBeInTheDocument()
    )
    expect(handler).not.toHaveBeenCalled()

    window.removeEventListener('cart-updated', handler)
  })

  it('does NOT dispatch cart-updated when DELETE throws network error', async () => {
    const user = userEvent.setup()
    mockFetch.mockRejectedValue(new Error('Network error'))

    const handler = vi.fn()
    window.addEventListener('cart-updated', handler)

    render(<CartPanel initialCart={makeCart()} />)
    await user.click(screen.getByRole('button', { name: 'Remove Burger' }))

    await waitFor(() =>
      expect(screen.getByText('Network error — please try again')).toBeInTheDocument()
    )
    expect(handler).not.toHaveBeenCalled()

    window.removeEventListener('cart-updated', handler)
  })
})
