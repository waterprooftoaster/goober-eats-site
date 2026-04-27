/**
 * @file swiper-registration-form.test.tsx
 * @description Behavioral tests for the swiper-registration form:
 *   step-1-to-step-2 transition after PATCH /api/profile succeeds; the
 *   continue-to-Stripe button stays disabled until the school is confirmed.
 *   Called by: Vitest test runner
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

import { SwiperRegistrationForm } from '@/app/swiper-registration/swiper-registration-form'

const SCHOOLS = [
  { id: 'school-1', name: 'NYU' },
  { id: 'school-2', name: 'Columbia' },
]

describe('<SwiperRegistrationForm />', () => {
  it('disables the continue-to-Stripe button until a school is confirmed', () => {
    render(<SwiperRegistrationForm schoolId={null} schoolName={null} schools={SCHOOLS} />)
    const cont = screen.getByTestId('swiper-reg-continue-button') as HTMLButtonElement
    expect(cont.disabled).toBe(true)
  })

  it('enables the continue button after PATCH /api/profile resolves OK with a pre-set schoolId', () => {
    // schoolId pre-set means the form starts in the "confirmed" state.
    render(
      <SwiperRegistrationForm
        schoolId="school-1"
        schoolName="NYU"
        schools={SCHOOLS}
      />,
    )
    const cont = screen.getByTestId('swiper-reg-continue-button') as HTMLButtonElement
    expect(cont.disabled).toBe(false)
  })

  it('redirects to Stripe URL on successful POST /api/stripe/connect', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ url: 'https://connect.stripe.com/setup/abc123' }),
    })
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, href: '' },
    })

    render(<SwiperRegistrationForm schoolId="school-1" schoolName="NYU" schools={SCHOOLS} />)
    fireEvent.click(screen.getByTestId('swiper-reg-continue-button'))

    await waitFor(() => {
      expect(window.location.href).toBe('https://connect.stripe.com/setup/abc123')
    })

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    })
  })

  it('renders the error message testid when POST /api/stripe/connect fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Stripe is unavailable. Try again in a moment.' }),
    })

    render(<SwiperRegistrationForm schoolId="school-1" schoolName="NYU" schools={SCHOOLS} />)
    fireEvent.click(screen.getByTestId('swiper-reg-continue-button'))

    await waitFor(() => {
      expect(screen.getByTestId('swiper-reg-error-message')).toHaveTextContent(/Stripe is unavailable/i)
    })
  })
})
