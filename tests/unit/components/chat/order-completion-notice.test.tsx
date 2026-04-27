/**
 * @file order-completion-notice.test.tsx
 * @description Unit tests for OrderCompletedView. Both roles share the same
 *   layout (photo or loading skeleton + label below). Only the label copy
 *   differs: orderer "Your Order is Ready!", swiper "Order Completed".
 *   Called by: Vitest test runner
 * @dependencies @testing-library/react, vitest
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrderCompletedView } from '@/components/chat/order-completion-notice'
import type { Message } from '@/lib/types/messaging'

const PHOTO: Message = {
  id: 'msg-1',
  conversation_id: 'conv-1',
  sender_id: 'user-swiper',
  body: null,
  message_type: 'completion_photo',
  expires_at: '2026-05-01T00:00:00Z',
  image_url: 'https://cdn.example.com/completion/abc.jpg',
  sent_at: '2026-04-26T12:00:00Z',
  temp_id: null,
}

describe('OrderCompletedView', () => {
  // --- Label copy by role ---

  it('orderer label reads "Your Order is Ready!"', () => {
    render(<OrderCompletedView viewerRole="orderer" deliveryPhoto={PHOTO} />)
    expect(screen.getByText('Your Order is Ready!')).toBeInTheDocument()
    expect(screen.queryByText('Order Completed')).not.toBeInTheDocument()
  })

  it('swiper label reads "Order Completed"', () => {
    render(<OrderCompletedView viewerRole="swiper" deliveryPhoto={PHOTO} />)
    expect(screen.getByText('Order Completed')).toBeInTheDocument()
    expect(screen.queryByText('Your Order is Ready!')).not.toBeInTheDocument()
  })

  // --- Photo present ---

  it('renders the photo + label for orderer', () => {
    render(<OrderCompletedView viewerRole="orderer" deliveryPhoto={PHOTO} />)
    const img = screen.getByRole('img', { name: /completion photo/i })
    expect(img.closest('a')?.getAttribute('href')).toBe(PHOTO.image_url)
    expect(screen.queryByTestId('order-completed-loading')).not.toBeInTheDocument()
  })

  it('renders the photo + label for swiper', () => {
    render(<OrderCompletedView viewerRole="swiper" deliveryPhoto={PHOTO} />)
    const img = screen.getByRole('img', { name: /completion photo/i })
    expect(img.closest('a')?.getAttribute('href')).toBe(PHOTO.image_url)
    expect(screen.queryByTestId('order-completed-loading')).not.toBeInTheDocument()
  })

  // --- Photo not yet available: shared skeleton, label still shown ---

  it('orderer sees skeleton + label when photo is null', () => {
    render(<OrderCompletedView viewerRole="orderer" deliveryPhoto={null} />)
    expect(screen.getByTestId('order-completed-loading')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Your Order is Ready!')).toBeInTheDocument()
  })

  it('swiper sees skeleton + label when photo is null', () => {
    render(<OrderCompletedView viewerRole="swiper" deliveryPhoto={null} />)
    expect(screen.getByTestId('order-completed-loading')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Order Completed')).toBeInTheDocument()
  })

  it('renders skeleton when image_url is null on the message', () => {
    const noUrl: Message = { ...PHOTO, image_url: null }
    render(<OrderCompletedView viewerRole="orderer" deliveryPhoto={noUrl} />)
    expect(screen.getByTestId('order-completed-loading')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  // --- Shared layout ---

  it('uses the same wrapper testid for both roles', () => {
    const { unmount } = render(
      <OrderCompletedView viewerRole="orderer" deliveryPhoto={PHOTO} />
    )
    expect(screen.getByTestId('order-completed-view')).toBeInTheDocument()
    unmount()
    render(<OrderCompletedView viewerRole="swiper" deliveryPhoto={PHOTO} />)
    expect(screen.getByTestId('order-completed-view')).toBeInTheDocument()
  })
})
