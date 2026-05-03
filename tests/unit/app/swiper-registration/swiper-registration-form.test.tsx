/**
 * @file swiper-registration-form.test.tsx
 * @description Behavioral tests for the swiper-registration form:
 *   button stays disabled until both school and name are filled; submitting
 *   sends one PATCH /api/profile then POSTs /api/stripe/connect and redirects.
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
  it('disables the continue-to-Stripe button when school and name are empty', () => {
    render(<SwiperRegistrationForm schoolId={null} schoolName={null} fullName={null} schools={SCHOOLS} />)
    const cont = screen.getByTestId('swiper-reg-continue-button') as HTMLButtonElement
    expect(cont.disabled).toBe(true)
  })

  it('enables the continue button when school and name are both pre-filled', () => {
    render(
      <SwiperRegistrationForm
        schoolId="school-1"
        schoolName="NYU"
        fullName="John Doe"
        schools={SCHOOLS}
      />,
    )
    const cont = screen.getByTestId('swiper-reg-continue-button') as HTMLButtonElement
    expect(cont.disabled).toBe(false)
  })

  it('redirects to Stripe URL on successful PATCH /api/profile + POST /api/stripe/connect', async () => {
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

    render(<SwiperRegistrationForm schoolId="school-1" schoolName="NYU" fullName="John Doe" schools={SCHOOLS} />)
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

  it('renders the error message testid when the profile PATCH fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Failed to save profile.' }),
    })

    render(<SwiperRegistrationForm schoolId="school-1" schoolName="NYU" fullName="John Doe" schools={SCHOOLS} />)
    fireEvent.click(screen.getByTestId('swiper-reg-continue-button'))

    await waitFor(() => {
      expect(screen.getByTestId('swiper-reg-error-message')).toHaveTextContent(/Failed to save profile/i)
    })
  })
})
