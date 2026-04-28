/**
 * @file pending-orders-list.test.tsx
 * @description Behavioral tests for the swiper queue accept state machine:
 *   200 success path → openPanel + green banner + row removed;
 *   409 race → row removed + red banner;
 *   403/5xx → inline modal error, modal stays open;
 *   accepting → button is disabled.
 *   Called by: Vitest test runner
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const openPanelMock = vi.fn()

vi.mock('@/components/chat-panel', () => ({
  useChatPanel: () => ({
    openPanel: openPanelMock,
    closePanel: vi.fn(),
    toggleMinimize: vi.fn(),
    updateOrderStatus: vi.fn(),
    orders: {},
  }),
}))

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span data-stub-img={alt} />,
}))

import { PendingOrdersList, type PendingOrder } from '@/app/swiper/orders/pending-orders-list'

function buildOrder(id: string, restaurantName = 'Chipotle'): PendingOrder {
  return {
    id,
    subtotal_cents: 2500,
    restaurant_name: restaurantName,
    cart_screenshot_urls: ['https://example.test/screenshot.jpg'],
    created_at: new Date().toISOString(),
  }
}

const fetchMock = vi.fn()

beforeEach(() => {
  openPanelMock.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('<PendingOrdersList /> accept state machine', () => {
  it('on 200, calls openPanel(orderId, "in_progress"), removes the row, and shows the success banner', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    const order = buildOrder('order-1', 'Chipotle')
    render(<PendingOrdersList orders={[order]} />)

    fireEvent.click(screen.getByTestId('order-card'))
    expect(screen.getByTestId('swiper-order-detail-modal')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('swiper-accept-button'))

    await waitFor(() => {
      expect(openPanelMock).toHaveBeenCalledWith('order-1', 'in_progress')
    })
    expect(screen.queryByTestId('swiper-order-detail-modal')).toBeNull()
    expect(screen.getByTestId('swiper-accept-success-banner')).toHaveTextContent(/Chipotle/)
    expect(screen.getByTestId('swiper-orders-empty-state')).toBeInTheDocument()
  })

  it('on 409, removes the row from the local queue and renders the race-condition banner', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({}) })
    const order = buildOrder('order-2')
    render(<PendingOrdersList orders={[order, buildOrder('order-3')]} />)

    fireEvent.click(screen.getAllByTestId('order-card')[0])
    fireEvent.click(screen.getByTestId('swiper-accept-button'))

    await waitFor(() => {
      expect(screen.queryByTestId('swiper-order-detail-modal')).toBeNull()
    })
    expect(openPanelMock).not.toHaveBeenCalled()
    expect(screen.getByText(/just accepted by another swiper/i)).toBeInTheDocument()
    expect(screen.getAllByTestId('order-card')).toHaveLength(1)
  })

  it('on 403, renders inline error inside the modal (modal stays open)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Complete Stripe onboarding first.' }),
    })
    const order = buildOrder('order-4')
    render(<PendingOrdersList orders={[order]} />)

    fireEvent.click(screen.getByTestId('order-card'))
    fireEvent.click(screen.getByTestId('swiper-accept-button'))

    await waitFor(() => {
      expect(screen.getByText(/Complete Stripe onboarding first/i)).toBeInTheDocument()
    })
    expect(screen.getByTestId('swiper-order-detail-modal')).toBeInTheDocument()
    expect(openPanelMock).not.toHaveBeenCalled()
  })

  it('disables the accept button while the request is in flight', async () => {
    let resolveFetch: (v: { ok: boolean; status: number; json: () => Promise<unknown> }) => void = () => {}
    fetchMock.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve }))
    const order = buildOrder('order-5')
    render(<PendingOrdersList orders={[order]} />)

    fireEvent.click(screen.getByTestId('order-card'))
    fireEvent.click(screen.getByTestId('swiper-accept-button'))

    const btn = screen.getByTestId('swiper-accept-button') as HTMLButtonElement
    await waitFor(() => { expect(btn.disabled).toBe(true) })

    await act(async () => {
      resolveFetch({ ok: true, status: 200, json: async () => ({}) })
    })

    await waitFor(() => {
      expect(screen.queryByTestId('swiper-order-detail-modal')).toBeNull()
    })
  })
})
