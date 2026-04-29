/**
 * @file pending-orders-list.test.tsx
 * @description Behavioral tests for the swiper queue accept state machine:
 *   200 success path → hard redirect to /current-orders;
 *   409 race → row removed + red banner;
 *   403/5xx → inline modal error, modal stays open;
 *   accepting → button is disabled.
 *   Called by: Vitest test runner
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

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
const assignMock = vi.fn()
let originalLocation: Location

beforeEach(() => {
  fetchMock.mockReset()
  assignMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  // window.location.assign is non-configurable in jsdom; replace the whole
  // location object with a writable mock for the test.
  originalLocation = window.location
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { assign: assignMock },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  })
})

describe('<PendingOrdersList /> accept state machine', () => {
  it('on 200, hard-redirects to /current-orders', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    const order = buildOrder('order-1', 'Chipotle')
    render(<PendingOrdersList orders={[order]} />)

    fireEvent.click(screen.getByTestId('order-card'))
    expect(screen.getByTestId('swiper-order-detail-modal')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('swiper-accept-button'))

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith('/current-orders')
    })
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
    expect(assignMock).not.toHaveBeenCalled()
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
    expect(assignMock).not.toHaveBeenCalled()
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
      expect(assignMock).toHaveBeenCalledWith('/current-orders')
    })
  })
})
