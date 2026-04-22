/**
 * @file pending.test.ts
 * @description Unit tests for GET /api/swiper/pending after the GrubHub pivot.
 *   Verifies school scoping via orders.school_id (not eateries) and the new
 *   response fields (restaurant_name, cart_screenshot_urls).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

import { GET } from '@/app/api/swiper/pending/route'

function dbResult(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const mock: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is', 'order', 'in']) {
    mock[m] = vi.fn(() => mock)
  }
  mock.single = vi.fn(() => Promise.resolve(result))
  mock.maybeSingle = vi.fn(() => Promise.resolve(result))
  mock.then = (resolve: (v: typeof result) => void) =>
    Promise.resolve(result).then(resolve)
  return mock
}

const USER_ID = '00000000-0000-4000-8000-000000000001'
const NYU_SCHOOL_ID = '00000000-0000-4000-8000-000000000aaa'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/swiper/pending', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not a swiper', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockFrom.mockReturnValueOnce(
      dbResult({ data: { is_swiper: false, school_id: NYU_SCHOOL_ID } })
    )
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns empty array when swiper has no school_id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockFrom.mockReturnValueOnce(
      dbResult({ data: { is_swiper: true, school_id: null } })
    )
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('queries orders with status=open, swiper_id=null, school_id=profile.school_id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    const profileChain = dbResult({ data: { is_swiper: true, school_id: NYU_SCHOOL_ID } })
    const ordersChain = dbResult({ data: [] })
    mockFrom.mockReturnValueOnce(profileChain).mockReturnValueOnce(ordersChain)

    const res = await GET()
    expect(res.status).toBe(200)

    // The orders chain is the second from() call
    expect(ordersChain.eq).toHaveBeenCalledWith('status', 'open')
    expect(ordersChain.is).toHaveBeenCalledWith('swiper_id', null)
    expect(ordersChain.eq).toHaveBeenCalledWith('school_id', NYU_SCHOOL_ID)
    expect(ordersChain.order).toHaveBeenCalledWith('created_at', { ascending: true })
  })

  it('returns order rows with new fields (restaurant_name, cart_screenshot_urls)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    const orders = [
      {
        id: 'order-1',
        restaurant_name: 'Chipotle',
        cart_screenshot_urls: ['pre-checkout/ABCdef1234/00000000-0000-4000-8000-000000000010.png'],
        total_cents: 1500,
        created_at: '2026-04-22T00:00:00Z',
      },
    ]
    mockFrom
      .mockReturnValueOnce(dbResult({ data: { is_swiper: true, school_id: NYU_SCHOOL_ID } }))
      .mockReturnValueOnce(dbResult({ data: orders }))

    const res = await GET()
    const body = await res.json()
    expect(body).toEqual(orders)
    expect(body[0]).toHaveProperty('restaurant_name')
    expect(body[0]).toHaveProperty('cart_screenshot_urls')
    expect(body[0]).not.toHaveProperty('eatery_id')
    expect(body[0]).not.toHaveProperty('items')
  })
})
