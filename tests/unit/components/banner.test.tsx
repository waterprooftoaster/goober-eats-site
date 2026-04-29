/**
 * @file banner.test.tsx
 * @description Asserts the visibility rules for the "Become a swiper" banner:
 *   shown only on `/`, only for non-swipers, and for guests only after a school
 *   has been picked (PENDING_SCHOOL_ID_KEY in sessionStorage). Authed users on
 *   `/` always see the banner. The check happens client-side via usePathname
 *   and a sessionStorage read on mount.
 *   Called by: Vitest test runner
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const { pathnameSpy } = vi.hoisted(() => ({
  pathnameSpy: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameSpy(),
}))

import { Banner } from '@/components/banner'
import { PENDING_SCHOOL_ID_KEY } from '@/lib/constants'

const TESTID = 'become-swiper-banner'

describe('Banner visibility rules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    pathnameSpy.mockReturnValue('/')
  })

  it('renders for an authed non-swiper on /', async () => {
    render(<Banner isSwiper={false} isLoggedIn />)
    await waitFor(() => {
      expect(screen.queryByTestId(TESTID)).not.toBeNull()
    })
  })

  it('does not render for a guest on / when no school is in sessionStorage (cover view)', () => {
    render(<Banner isSwiper={false} isLoggedIn={false} />)
    expect(screen.queryByTestId(TESTID)).toBeNull()
  })

  it('renders for a guest on / after mount when PENDING_SCHOOL_ID_KEY is set (upload view)', async () => {
    sessionStorage.setItem(PENDING_SCHOOL_ID_KEY, 'sch-1')

    render(<Banner isSwiper={false} isLoggedIn={false} />)

    await waitFor(() => {
      expect(screen.queryByTestId(TESTID)).not.toBeNull()
    })
  })

  it('does not render off the home route', () => {
    pathnameSpy.mockReturnValue('/account')
    render(<Banner isSwiper={false} isLoggedIn />)
    expect(screen.queryByTestId(TESTID)).toBeNull()
  })

  it('does not render for a swiper', () => {
    render(<Banner isSwiper isLoggedIn />)
    expect(screen.queryByTestId(TESTID)).toBeNull()
  })
})
