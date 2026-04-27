/**
 * @file modal.test.tsx
 * @description Render tests for the Modal primitive — open via trigger, content carries testid, close works.
 *   Called by: Vitest
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import {
  Modal,
  ModalContent,
  ModalTitle,
  ModalTrigger,
} from '@/components/ui/modal'

describe('<Modal />', () => {
  it('opens via trigger and exposes the catalog testid on its content', async () => {
    const user = userEvent.setup()
    render(
      <Modal>
        <ModalTrigger>open me</ModalTrigger>
        <ModalContent>
          <ModalTitle>are you sure?</ModalTitle>
        </ModalContent>
      </Modal>
    )

    expect(screen.queryByTestId('modal')).toBeNull()

    await user.click(screen.getByText('open me'))

    expect(screen.getByTestId('modal')).toBeInTheDocument()
    expect(screen.getByText('are you sure?')).toBeInTheDocument()
  })

  it('closes via the built-in close button', async () => {
    const user = userEvent.setup()
    render(
      <Modal defaultOpen>
        <ModalContent>
          <ModalTitle>title</ModalTitle>
        </ModalContent>
      </Modal>
    )

    expect(screen.getByTestId('modal')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Close'))
    expect(screen.queryByTestId('modal')).toBeNull()
  })
})
