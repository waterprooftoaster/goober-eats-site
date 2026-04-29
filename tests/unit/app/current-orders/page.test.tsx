/**
 * @file page.test.tsx
 * @description Unit tests asserting the /current-orders server component queries
 *   only `open` and `in_progress` statuses (NOT `completed` — that lives on /orders).
 *   Called by: Vitest test runner
 * @dependencies @/lib/supabase/server (mocked), next/navigation (mocked)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const { inSpy, fromSpy, getUserSpy, redirectSpy } = vi.hoisted(() => {
  const orderSpy = vi.fn().mockResolvedValue({ data: [] })
  const inSpy = vi.fn().mockReturnValue({ order: orderSpy })
  const orSpy = vi.fn().mockReturnValue({ in: inSpy })
  const selectSpy = vi.fn().mockReturnValue({ or: orSpy })
  const fromSpy = vi.fn().mockReturnValue({ select: selectSpy })
  const getUserSpy = vi.fn()
  const redirectSpy = vi.fn()
  return { inSpy, fromSpy, getUserSpy, redirectSpy }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: getUserSpy },
    from: fromSpy,
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    redirectSpy(path)
    throw new Error(`__REDIRECT__:${path}`)
  },
}))

// Stub the client list — its render output is irrelevant here.
vi.mock('@/app/current-orders/current-orders-list', () => ({
  CurrentOrdersList: () => null,
}))

// sign-screenshots transitively imports `server-only`, which throws under
// vitest's jsdom env. Stub the helper — these tests don't assert on URLs.
vi.mock('@/lib/storage/sign-screenshots', () => ({
  signCartScreenshotPaths: vi.fn().mockResolvedValue([]),
}))

import CurrentOrdersPage from '@/app/current-orders/page'

describe('CurrentOrdersPage query', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserSpy.mockResolvedValue({ data: { user: { id: 'u1' } } })
  })

  it('queries .in("status", ["open", "in_progress"]) — does not include "completed"', async () => {
    await CurrentOrdersPage()
    expect(fromSpy).toHaveBeenCalledWith('orders')
    expect(inSpy).toHaveBeenCalledTimes(1)
    expect(inSpy).toHaveBeenCalledWith('status', ['open', 'in_progress'])
    const passedStatuses = inSpy.mock.calls[0][1] as string[]
    expect(passedStatuses).not.toContain('completed')
  })

  it('redirects unauthenticated users to /auth/login', async () => {
    getUserSpy.mockResolvedValueOnce({ data: { user: null } })
    await expect(CurrentOrdersPage()).rejects.toThrow(/__REDIRECT__:\/auth\/login/)
    expect(redirectSpy).toHaveBeenCalledWith('/auth/login')
    expect(fromSpy).not.toHaveBeenCalled()
  })
})
