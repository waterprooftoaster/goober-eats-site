/**
 * @file accept.test.ts
 * @description Unit tests for PATCH /api/orders/[id]/accept after the pivot.
 *   Verifies school scoping uses orders.school_id directly (no eateries
 *   join), and the atomic claim via service client is unchanged.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockServerFrom, mockServiceFrom, mockSignCartScreenshotPaths } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockServerFrom: vi.fn(),
  mockServiceFrom: vi.fn(),
  mockSignCartScreenshotPaths: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockServerFrom,
  })),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom })),
}))

vi.mock('@/lib/storage/sign-screenshots', () => ({
  signCartScreenshotPaths: mockSignCartScreenshotPaths,
}))

import { PATCH } from '@/app/api/orders/[id]/accept/route'

function dbResult(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const mock: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'is']) {
    mock[m] = vi.fn(() => mock)
  }
  mock.single = vi.fn(() => Promise.resolve(result))
  mock.maybeSingle = vi.fn(() => Promise.resolve(result))
  mock.then = (resolve: (v: typeof result) => void) =>
    Promise.resolve(result).then(resolve)
  return mock
}

const USER_ID = '00000000-0000-4000-8000-000000000001'
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002'
const NYU_SCHOOL_ID = '00000000-0000-4000-8000-000000000aaa'
const COLUMBIA_SCHOOL_ID = '00000000-0000-4000-8000-000000000bbb'
const ORDER_ID = '00000000-0000-4000-8000-000000000100'

async function callPatch(): Promise<Response> {
  const req = new NextRequest(`http://localhost/api/orders/${ORDER_ID}/accept`, {
    method: 'PATCH',
  })
  return PATCH(req, { params: Promise.resolve({ id: ORDER_ID }) })
}

function setupEligibleSwiper(schoolId: string) {
  // Server client chain:
  //   1. orders.select (order row)
  //   2. stripe_accounts.select
  //   3. profiles.select
  mockServerFrom.mockReset()
  mockServerFrom
    .mockReturnValueOnce(
      dbResult({
        data: {
          id: ORDER_ID,
          orderer_id: OTHER_USER_ID,
          swiper_id: null,
          school_id: schoolId,
          status: 'open',
        },
      })
    )
    .mockReturnValueOnce(dbResult({ data: { onboarding_complete: true } }))
    .mockReturnValueOnce(
      dbResult({ data: { is_swiper: true, school_id: NYU_SCHOOL_ID, full_name: 'Alex' } })
    )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  mockSignCartScreenshotPaths.mockImplementation(async (paths: string[]) =>
    paths.map((p) => `https://signed.test/${p}`)
  )
})

describe('PATCH /api/orders/[id]/accept', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const res = await callPatch()
    expect(res.status).toBe(401)
  })

  it('returns 404 when order not found', async () => {
    mockServerFrom.mockReturnValueOnce(dbResult({ data: null }))
    const res = await callPatch()
    expect(res.status).toBe(404)
  })

  it('returns 409 when order is already claimed', async () => {
    mockServerFrom.mockReturnValueOnce(
      dbResult({
        data: {
          id: ORDER_ID,
          orderer_id: OTHER_USER_ID,
          swiper_id: 'some-swiper',
          school_id: NYU_SCHOOL_ID,
          status: 'in_progress',
        },
      })
    )
    const res = await callPatch()
    expect(res.status).toBe(409)
  })

  it('returns 403 when order.school_id differs from swiper.school_id (cross-school)', async () => {
    setupEligibleSwiper(COLUMBIA_SCHOOL_ID) // NYU swiper, Columbia order
    const res = await callPatch()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/school/i)
    // Must NOT have called the service client (no atomic claim attempted)
    expect(mockServiceFrom).not.toHaveBeenCalled()
  })

  it('returns 403 when swiper has no Stripe onboarding', async () => {
    mockServerFrom
      .mockReturnValueOnce(
        dbResult({
          data: {
            id: ORDER_ID,
            orderer_id: OTHER_USER_ID,
            swiper_id: null,
            school_id: NYU_SCHOOL_ID,
            status: 'open',
          },
        })
      )
      .mockReturnValueOnce(dbResult({ data: { onboarding_complete: false } }))
    const res = await callPatch()
    expect(res.status).toBe(403)
  })

  it('returns 403 when the swiper attempts to accept their own order', async () => {
    mockServerFrom.mockReturnValueOnce(
      dbResult({
        data: {
          id: ORDER_ID,
          orderer_id: USER_ID,
          swiper_id: null,
          school_id: NYU_SCHOOL_ID,
          status: 'open',
        },
      })
    )
    const res = await callPatch()
    expect(res.status).toBe(403)
  })

  it('claims atomically and returns updated order on success', async () => {
    setupEligibleSwiper(NYU_SCHOOL_ID) // match

    // Service client chain:
    //   1. orders.update(...).eq(...).eq(...).is(...).select(...).single()
    //   2. conversations.insert(...)
    const updatedOrder = {
      id: ORDER_ID,
      orderer_id: OTHER_USER_ID,
      swiper_id: USER_ID,
      school_id: NYU_SCHOOL_ID,
      restaurant_name: 'Chipotle',
      cart_screenshot_urls: ['pre-checkout/ABCdef1234/00000000-0000-4000-8000-000000000010.png'],
      status: 'in_progress',
      subtotal_cents: 2500,
      total_cents: 1500,
      guest_name: null,
      guest_email: null,
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    }
    const updateChain = dbResult({ data: updatedOrder })
    const convChain = dbResult({ data: null, error: null })
    mockServiceFrom.mockReturnValueOnce(updateChain).mockReturnValueOnce(convChain)

    const res = await callPatch()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toEqual(updatedOrder.id)
    expect(body.cart_screenshot_urls).toEqual([
      'https://signed.test/pre-checkout/ABCdef1234/00000000-0000-4000-8000-000000000010.png',
    ])
    expect(mockSignCartScreenshotPaths).toHaveBeenCalledWith(updatedOrder.cart_screenshot_urls)

    // Atomic WHERE clause: status=open + swiper_id IS NULL
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ swiper_id: USER_ID, status: 'in_progress' })
    )
    expect(updateChain.eq).toHaveBeenCalledWith('status', 'open')
    expect(updateChain.is).toHaveBeenCalledWith('swiper_id', null)
  })

  it('returns 409 when the atomic claim loses the race', async () => {
    setupEligibleSwiper(NYU_SCHOOL_ID)
    const updateChain = dbResult({
      data: null,
      error: { message: 'no rows updated', code: 'PGRST116' },
    })
    mockServiceFrom.mockReturnValueOnce(updateChain)

    const res = await callPatch()
    expect(res.status).toBe(409)
  })
})
