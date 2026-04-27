/**
 * @file sheet.test.tsx
 * @description Render + integration specs for components/ui/sheet.tsx (vaul-backed).
 *   Drag behavior is owned + tested by vaul upstream; these specs verify the
 *   integration boundary (open/close, content rendering, controlled mode,
 *   onOpenChange wiring, the GLOBAL-SHEET catalog testid, and the built-in
 *   close affordance).
 *   Called by: Vitest
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet'

afterEach(cleanup)

describe('<Sheet /> (vaul-backed, S07)', () => {
  it('opens via trigger and exposes the catalog testid on its content', async () => {
    const user = userEvent.setup()
    render(
      <Sheet>
        <SheetTrigger>open me</SheetTrigger>
        <SheetContent>
          <SheetTitle>title here</SheetTitle>
          <p>body</p>
        </SheetContent>
      </Sheet>
    )

    expect(screen.queryByTestId('sheet')).toBeNull()

    await user.click(screen.getByText('open me'))

    expect(screen.getByTestId('sheet')).toBeInTheDocument()
    expect(screen.getByText('title here')).toBeInTheDocument()
  })

  it('closes via the built-in close button (fires onOpenChange(false) — uncontrolled)', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <Sheet defaultOpen onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetTitle>title</SheetTitle>
        </SheetContent>
      </Sheet>
    )

    expect(screen.getByTestId('sheet')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Close'))
    // vaul's actual unmount runs through its slide-out animation; jsdom does
    // not finish CSS animations, so we assert via the onOpenChange callback.
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders SheetContent children in controlled-open mode', () => {
    render(
      <Sheet open={true} onOpenChange={() => {}}>
        <SheetContent>
          <SheetTitle>Order chat</SheetTitle>
          <SheetDescription>Talk to your swiper</SheetDescription>
          <p>chat body</p>
        </SheetContent>
      </Sheet>
    )

    expect(screen.getByText('Order chat')).toBeInTheDocument()
    expect(screen.getByText('Talk to your swiper')).toBeInTheDocument()
    expect(screen.getByText('chat body')).toBeInTheDocument()
  })

  it('does NOT render SheetContent children when controlled open=false', () => {
    render(
      <Sheet open={false} onOpenChange={() => {}}>
        <SheetContent>
          <SheetTitle>Hidden</SheetTitle>
        </SheetContent>
      </Sheet>
    )

    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sheet')).toBeNull()
  })

  it('fires onOpenChange(false) when the built-in close affordance is clicked', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <Sheet open={true} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetTitle>Closeable</SheetTitle>
        </SheetContent>
      </Sheet>
    )

    await user.click(screen.getByLabelText('Close'))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
