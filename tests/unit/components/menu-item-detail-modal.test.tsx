/**
 * @file menu-item-detail-modal.test.tsx
 * @description Unit tests for the MenuItemDetailModal component (item options, add-to-cart).
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement('img', { src, alt }),
}))

vi.mock('@base-ui/react', () => ({
  Dialog: {
    Root: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Portal: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Backdrop: () => null,
    Popup: ({ children, role }: { children: React.ReactNode; role?: string }) =>
      React.createElement('div', { role: role ?? 'dialog' }, children),
    Close: ({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) =>
      React.createElement('button', props, children),
  },
}))

vi.mock('@/components/menu-item-option-group', () => ({
  MenuItemOptionGroup: () => null,
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
import { MenuItemDetailModal } from '@/components/menu-item-detail-modal'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TEST_ITEM = { id: 'item-1', name: 'Burger', image_url: null }

function setupFetchForSuccessfulAdd() {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ groups: [] }),
    }) // GET /api/menu-items/{id}/options
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    }) // POST /api/cart/items
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('MenuItemDetailModal — cart-updated event dispatch', () => {
  it('dispatches cart-updated on window after successful Add to Cart', async () => {
    const user = userEvent.setup()
    setupFetchForSuccessfulAdd()

    const handler = vi.fn()
    window.addEventListener('cart-updated', handler)

    render(<MenuItemDetailModal item={TEST_ITEM} onClose={vi.fn()} />)

    // Wait for options to load (loading indicator disappears)
    await waitFor(() =>
      expect(screen.queryByTestId('options-loading')).not.toBeInTheDocument()
    )

    await user.click(screen.getByRole('button', { name: 'Add to Cart' }))

    await waitFor(() => expect(handler).toHaveBeenCalledTimes(1))

    window.removeEventListener('cart-updated', handler)
  })

  it('does NOT dispatch cart-updated when POST returns non-ok', async () => {
    const user = userEvent.setup()
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ groups: [] }),
      }) // GET options
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Out of stock' }),
      }) // POST fails

    const handler = vi.fn()
    window.addEventListener('cart-updated', handler)

    render(<MenuItemDetailModal item={TEST_ITEM} onClose={vi.fn()} />)

    await waitFor(() =>
      expect(screen.queryByTestId('options-loading')).not.toBeInTheDocument()
    )

    await user.click(screen.getByRole('button', { name: 'Add to Cart' }))

    await waitFor(() => expect(screen.getByText('Out of stock')).toBeInTheDocument())
    expect(handler).not.toHaveBeenCalled()

    window.removeEventListener('cart-updated', handler)
  })

  it('does NOT dispatch cart-updated when POST throws network error', async () => {
    const user = userEvent.setup()
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ groups: [] }),
      }) // GET options
      .mockRejectedValueOnce(new Error('Network error')) // POST throws

    const handler = vi.fn()
    window.addEventListener('cart-updated', handler)

    render(<MenuItemDetailModal item={TEST_ITEM} onClose={vi.fn()} />)

    await waitFor(() =>
      expect(screen.queryByTestId('options-loading')).not.toBeInTheDocument()
    )

    await user.click(screen.getByRole('button', { name: 'Add to Cart' }))

    await waitFor(() =>
      expect(screen.getByText('Network error — please try again')).toBeInTheDocument()
    )
    expect(handler).not.toHaveBeenCalled()

    window.removeEventListener('cart-updated', handler)
  })
})
