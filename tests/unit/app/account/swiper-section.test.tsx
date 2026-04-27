/**
 * @file swiper-section.test.tsx
 * @description Behavioral tests for the swiper-section "Change school" flow:
 *   the Save button soft-disables while PATCH /api/profile is in flight, and
 *   the dashboard button POSTs to /api/stripe/connect/dashboard (per catalog
 *   SWIP-ACCOUNT-STRIPE-DASHBOARD), not /api/stripe/connect.
 *   Called by: Vitest test runner
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, back: vi.fn(), push: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({ children, ...rest }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a {...rest}>{children}</a>
  ),
}))

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  refreshMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

import { SwiperSection } from '@/app/account/swiper-section'

const SCHOOLS = [
  { id: 'school-1', name: 'NYU' },
  { id: 'school-2', name: 'Columbia' },
]

describe('<SwiperSection /> swiper-active branch', () => {
  it('soft-disables the school save button while PATCH /api/profile is in flight, then settles', async () => {
    let resolveFetch: (v: { ok: boolean; status: number; json: () => Promise<unknown> }) => void = () => {}
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve }))

    render(
      <SwiperSection
        profile={{ is_swiper: true, school_id: 'school-1' }}
        stripeAccount={{ onboarding_complete: true }}
        schools={SCHOOLS}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /change/i }))
    // Combobox is rendered; we don't drive its inner state — just simulate a
    // selected school by clicking Save with the pre-set school value.
    const saveBtn = screen.getByTestId('account-school-save-button') as HTMLButtonElement
    expect(saveBtn.disabled).toBe(false)

    fireEvent.click(saveBtn)
    await waitFor(() => { expect(saveBtn.disabled).toBe(true) })
    expect(saveBtn).toHaveTextContent(/saving/i)

    await act(async () => {
      resolveFetch({ ok: true, status: 200, json: async () => ({}) })
    })

    await waitFor(() => { expect(refreshMock).toHaveBeenCalled() })
    expect(fetchMock).toHaveBeenCalledWith('/api/profile', expect.objectContaining({ method: 'PATCH' }))
  })

  it('routes the dashboard button to /api/stripe/connect/dashboard (catalog SWIP-ACCOUNT-STRIPE-DASHBOARD)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ url: 'https://connect.stripe.com/express/login/abc' }),
    })

    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, href: '' },
    })

    render(
      <SwiperSection
        profile={{ is_swiper: true, school_id: 'school-1' }}
        stripeAccount={{ onboarding_complete: true }}
        schools={SCHOOLS}
      />,
    )

    fireEvent.click(screen.getByTestId('account-stripe-dashboard-button'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/stripe/connect/dashboard',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    })
  })

  it('routes the link button to /api/stripe/connect when onboarding is incomplete', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ url: 'https://connect.stripe.com/setup/abc' }),
    })

    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, href: '' },
    })

    render(
      <SwiperSection
        profile={{ is_swiper: true, school_id: 'school-1' }}
        stripeAccount={{ onboarding_complete: false }}
        schools={SCHOOLS}
      />,
    )

    fireEvent.click(screen.getByTestId('account-stripe-link-button'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/stripe/connect',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    })
  })
})

describe('<SwiperSection /> non-swiper branch', () => {
  it('renders the become-swiper CTA pointing at /swiper-registration', () => {
    render(
      <SwiperSection
        profile={{ is_swiper: false, school_id: null }}
        stripeAccount={null}
        schools={SCHOOLS}
      />,
    )
    const cta = screen.getByTestId('account-become-swiper-cta')
    expect(cta).toBeInTheDocument()
    expect(cta).toHaveAttribute('href', '/swiper-registration')
  })
})
