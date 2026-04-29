/**
 * @file guest-home-router.test.tsx
 * @description Asserts that the guest home router renders CoverPage when no
 *   school selection is in sessionStorage and HomeUpload when one is present.
 *   The component runs only on the client, so the swap happens after the
 *   first useEffect tick.
 *   Called by: Vitest test runner
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const { coverSpy, uploadSpy } = vi.hoisted(() => ({
  coverSpy: vi.fn<(props: { schools: Array<{ id: string; name: string }> }) => null>(),
  uploadSpy: vi.fn<(props: unknown) => null>(),
}))

vi.mock('@/components/cover-page', () => ({
  __esModule: true,
  default: (props: { schools: Array<{ id: string; name: string }> }) => {
    coverSpy(props)
    return <div data-testid="cover-stub" />
  },
}))

vi.mock('@/components/home-upload', () => ({
  __esModule: true,
  default: (props: unknown) => {
    uploadSpy(props)
    return <div data-testid="home-upload-stub" />
  },
}))

import GuestHomeRouter from '@/components/guest-home-router'
import { PENDING_SCHOOL_ID_KEY } from '@/lib/constants'

const SCHOOLS = [{ id: 'sch-1', name: 'NYU' }]

describe('GuestHomeRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it('renders CoverPage when no PENDING_SCHOOL_ID_KEY is set', async () => {
    render(<GuestHomeRouter schools={SCHOOLS} />)

    await waitFor(() => {
      expect(screen.queryByTestId('cover-stub')).not.toBeNull()
    })
    expect(screen.queryByTestId('home-upload-stub')).toBeNull()
    expect(coverSpy).toHaveBeenCalled()
    const lastCoverProps = coverSpy.mock.calls.at(-1)?.[0]
    expect(lastCoverProps?.schools).toEqual(SCHOOLS)
  })

  it('renders HomeUpload after mount when PENDING_SCHOOL_ID_KEY is set', async () => {
    sessionStorage.setItem(PENDING_SCHOOL_ID_KEY, 'sch-1')

    render(<GuestHomeRouter schools={SCHOOLS} />)

    await waitFor(() => {
      expect(screen.queryByTestId('home-upload-stub')).not.toBeNull()
    })
    expect(screen.queryByTestId('cover-stub')).toBeNull()
  })
})
