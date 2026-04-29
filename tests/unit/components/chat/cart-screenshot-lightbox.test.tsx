/**
 * @file cart-screenshot-lightbox.test.tsx
 * @description Unit tests for CartScreenshotLightbox: opens/closes via the
 *   `open` prop, X click invokes onClose, backdrop click invokes onClose,
 *   image click does not, dialog reopens after closing, image hidden when
 *   url is null.
 *   Called by: Vitest test runner
 * @dependencies @testing-library/react
 */

import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import CartScreenshotLightbox from '@/components/chat/cart-screenshot-lightbox'

const URL = 'https://example.com/cart.png'

function Harness({ initialOpen = false, url = URL }: { initialOpen?: boolean; url?: string | null }) {
  const [open, setOpen] = useState(initialOpen)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>open</button>
      <CartScreenshotLightbox open={open} onClose={() => setOpen(false)} url={url} />
    </>
  )
}

describe('CartScreenshotLightbox', () => {
  it('is closed by default', () => {
    render(<CartScreenshotLightbox open={false} onClose={vi.fn()} url={URL} />)
    const dialog = screen.getByTestId('cart-screenshot-lightbox') as HTMLDialogElement
    expect(dialog.open).toBe(false)
  })

  it('opens when the open prop becomes true', () => {
    render(<Harness />)
    const dialog = screen.getByTestId('cart-screenshot-lightbox') as HTMLDialogElement
    expect(dialog.open).toBe(false)
    fireEvent.click(screen.getByText('open'))
    expect(dialog.open).toBe(true)
  })

  it('invokes onClose when the X button is clicked', () => {
    const onClose = vi.fn()
    render(<CartScreenshotLightbox open={true} onClose={onClose} url={URL} />)
    fireEvent.click(screen.getByTestId('cart-screenshot-lightbox-close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('invokes onClose when the backdrop wrapper is tapped (empty area, not the image)', () => {
    const onClose = vi.fn()
    render(<CartScreenshotLightbox open={true} onClose={onClose} url={URL} />)
    const backdrop = screen.getByTestId('cart-screenshot-lightbox-backdrop')
    fireEvent.click(backdrop, { target: backdrop })
    expect(onClose).toHaveBeenCalled()
  })

  it('does not close when a click lands on the image area (inner content)', () => {
    const onClose = vi.fn()
    render(<CartScreenshotLightbox open={true} onClose={onClose} url={URL} />)
    fireEvent.click(screen.getByAltText('Cart screenshot'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('can be reopened after being closed', () => {
    render(<Harness />)
    const dialog = screen.getByTestId('cart-screenshot-lightbox') as HTMLDialogElement
    fireEvent.click(screen.getByText('open'))
    expect(dialog.open).toBe(true)
    fireEvent.click(screen.getByTestId('cart-screenshot-lightbox-close'))
    expect(dialog.open).toBe(false)
    fireEvent.click(screen.getByText('open'))
    expect(dialog.open).toBe(true)
  })

  it('does not render the image when url is null', () => {
    render(<CartScreenshotLightbox open={false} onClose={vi.fn()} url={null} />)
    expect(screen.queryByAltText('Cart screenshot')).not.toBeInTheDocument()
  })
})
