/**
 * @file sheet.test.tsx
 * @description Render tests for the Sheet primitive — open via trigger, content carries testid, close works.
 *   Called by: Vitest
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

describe('<Sheet />', () => {
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

  it('closes via the built-in close button', async () => {
    const user = userEvent.setup()
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>title</SheetTitle>
        </SheetContent>
      </Sheet>
    )

    expect(screen.getByTestId('sheet')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Close'))
    expect(screen.queryByTestId('sheet')).toBeNull()
  })
})
