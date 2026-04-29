/**
 * @file page.test.tsx
 * @description Unit tests for the /current-orders server component. Asserts the
 *   page queries only `open`/`in_progress` orders, redirects when there is no
 *   Supabase session, and forks the filter on `user.is_anonymous` —
 *   anon_user_id for guests, orderer_id/swiper_id for real users.
 *   Called by: Vitest test runner
 * @dependencies @/lib/supabase/server (mocked), next/navigation (mocked)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const { eqSpy, orSpy, inSpy, fromSpy, getUserSpy, redirectSpy } = vi.hoisted(() => {
  const orderSpy = vi.fn()
  const eqSpy = vi.fn().mockResolvedValue({ data: [] })
  const orSpy = vi.fn().mockResolvedValue({ data: [] })
  // Builder shape: from().select().in().order() returns an object with both `or` and `eq`.
  // The page awaits whichever it calls; the unused one is never executed.
  orderSpy.mockReturnValue({ or: orSpy, eq: eqSpy })
  const inSpy = vi.fn().mockReturnValue({ order: orderSpy })
  const selectSpy = vi.fn().mockReturnValue({ in: inSpy })
  const fromSpy = vi.fn().mockReturnValue({ select: selectSpy })
  const getUserSpy = vi.fn()
  const redirectSpy = vi.fn()
  return { eqSpy, orSpy, inSpy, fromSpy, getUserSpy, redirectSpy }
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
    getUserSpy.mockResolvedValue({ data: { user: { id: 'u1', is_anonymous: false } } })
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

  it('authed users filter by orderer_id OR swiper_id via .or()', async () => {
    await CurrentOrdersPage()
    expect(orSpy).toHaveBeenCalledTimes(1)
    expect(orSpy).toHaveBeenCalledWith('orderer_id.eq.u1,swiper_id.eq.u1')
    expect(eqSpy).not.toHaveBeenCalled()
  })

  it('anonymous (guest) users filter by anon_user_id via .eq()', async () => {
    getUserSpy.mockResolvedValueOnce({ data: { user: { id: 'anon-uid', is_anonymous: true } } })
    await CurrentOrdersPage()
    expect(eqSpy).toHaveBeenCalledTimes(1)
    expect(eqSpy).toHaveBeenCalledWith('anon_user_id', 'anon-uid')
    expect(orSpy).not.toHaveBeenCalled()
  })
})
