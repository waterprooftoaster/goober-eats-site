/**
 * @file order-completion-notice.test.tsx
 * @description Unit tests for OrderCompletedView. Both roles share the same
 *   photo + label layout. Only the orderer sees the "Report a problem"
 *   affordance (or, once filed, the verdict pill). The swiper view is
 *   intentionally inert.
 *   Called by: Vitest test runner
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { OrderCompletedView } from '@/components/chat/order-completion-notice'
import type { Message } from '@/lib/types/messaging'

const ORDER_ID = '00000000-0000-4000-8000-000000000abc'

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

const realFetch = global.fetch

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  global.fetch = realFetch
})

function mockComplaintFetch(response: { status: number; complaint?: unknown }) {
  global.fetch = vi.fn().mockResolvedValue({
    status: response.status,
    ok: response.status === 200,
    json: async () => ({ complaint: response.complaint }),
  }) as unknown as typeof fetch
}

describe('OrderCompletedView — labels', () => {
  it('orderer label reads "Your Order is Ready!"', async () => {
    mockComplaintFetch({ status: 404 })
    render(<OrderCompletedView orderId={ORDER_ID} viewerRole="orderer" deliveryPhoto={PHOTO} />)
    expect(screen.getByText('Your Order is Ready!')).toBeInTheDocument()
    expect(screen.queryByText('Order Completed')).not.toBeInTheDocument()
  })

  it('swiper label reads "Order Completed"', () => {
    render(<OrderCompletedView orderId={ORDER_ID} viewerRole="swiper" deliveryPhoto={PHOTO} />)
    expect(screen.getByText('Order Completed')).toBeInTheDocument()
    expect(screen.queryByText('Your Order is Ready!')).not.toBeInTheDocument()
  })
})

describe('OrderCompletedView — photo + skeleton', () => {
  it('renders the photo + label for orderer', () => {
    mockComplaintFetch({ status: 404 })
    render(<OrderCompletedView orderId={ORDER_ID} viewerRole="orderer" deliveryPhoto={PHOTO} />)
    const img = screen.getByRole('img', { name: /completion photo/i })
    expect(img.closest('a')?.getAttribute('href')).toBe(PHOTO.image_url)
  })

  it('orderer sees skeleton + label when photo is null', () => {
    mockComplaintFetch({ status: 404 })
    render(<OrderCompletedView orderId={ORDER_ID} viewerRole="orderer" deliveryPhoto={null} />)
    expect(screen.getByTestId('order-completed-loading')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Your Order is Ready!')).toBeInTheDocument()
  })

  it('swiper sees skeleton + label when photo is null', () => {
    render(<OrderCompletedView orderId={ORDER_ID} viewerRole="swiper" deliveryPhoto={null} />)
    expect(screen.getByTestId('order-completed-loading')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Order Completed')).toBeInTheDocument()
  })

  it('uses the same wrapper testid for both roles', () => {
    mockComplaintFetch({ status: 404 })
    const { unmount } = render(
      <OrderCompletedView orderId={ORDER_ID} viewerRole="orderer" deliveryPhoto={PHOTO} />
    )
    expect(screen.getByTestId('order-completed-view')).toBeInTheDocument()
    unmount()
    render(<OrderCompletedView orderId={ORDER_ID} viewerRole="swiper" deliveryPhoto={PHOTO} />)
    expect(screen.getByTestId('order-completed-view')).toBeInTheDocument()
  })
})

describe('OrderCompletedView — complaint affordance (orderer-only)', () => {
  it('orderer sees a "Report a problem" button when no complaint exists', async () => {
    mockComplaintFetch({ status: 404 })
    render(<OrderCompletedView orderId={ORDER_ID} viewerRole="orderer" deliveryPhoto={PHOTO} />)
    const button = await screen.findByTestId('order-completed-report-button')
    expect(button).toHaveTextContent(/report a problem/i)
    expect(button.getAttribute('href')).toBe(`/orders/${ORDER_ID}/complaints/new`)
  })

  it('orderer sees a "Refund issued" pill when verdict is approve_refund', async () => {
    mockComplaintFetch({
      status: 200,
      complaint: { id: 'cid-1', verdict: 'approve_refund' },
    })
    render(<OrderCompletedView orderId={ORDER_ID} viewerRole="orderer" deliveryPhoto={PHOTO} />)
    const pill = await screen.findByTestId('order-completed-complaint-pill')
    expect(pill).toHaveTextContent('Refund issued')
    expect(screen.queryByTestId('order-completed-report-button')).not.toBeInTheDocument()
  })

  it('orderer sees a "Complaint denied" pill on deny verdict', async () => {
    mockComplaintFetch({ status: 200, complaint: { id: 'cid-2', verdict: 'deny' } })
    render(<OrderCompletedView orderId={ORDER_ID} viewerRole="orderer" deliveryPhoto={PHOTO} />)
    const pill = await screen.findByTestId('order-completed-complaint-pill')
    expect(pill).toHaveTextContent('Complaint denied')
  })

  it('orderer sees a "pending review" pill on escalate verdict', async () => {
    mockComplaintFetch({ status: 200, complaint: { id: 'cid-3', verdict: 'escalate' } })
    render(<OrderCompletedView orderId={ORDER_ID} viewerRole="orderer" deliveryPhoto={PHOTO} />)
    const pill = await screen.findByTestId('order-completed-complaint-pill')
    expect(pill).toHaveTextContent(/pending review/i)
  })

  it('swiper NEVER sees the report button or pill', async () => {
    mockComplaintFetch({ status: 404 })
    render(<OrderCompletedView orderId={ORDER_ID} viewerRole="swiper" deliveryPhoto={PHOTO} />)
    // Wait a tick so any pending fetch would have settled.
    await waitFor(() => {
      expect(screen.queryByTestId('order-completed-report-button')).not.toBeInTheDocument()
      expect(screen.queryByTestId('order-completed-complaint-pill')).not.toBeInTheDocument()
    })
  })

  it('swiper does not even fetch the complaint endpoint', async () => {
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as unknown as typeof fetch
    render(<OrderCompletedView orderId={ORDER_ID} viewerRole="swiper" deliveryPhoto={PHOTO} />)
    await waitFor(() => {
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })
})
