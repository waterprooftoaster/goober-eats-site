/**
 * @file route.test.ts
 * @description Unit tests for GET /api/orders. Verifies that cart_screenshot_urls
 *   on every returned row are replaced with signed URLs minted via the
 *   sign-screenshots helper.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockFrom, mockSignBatch } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockSignBatch: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

vi.mock('@/lib/storage/sign-screenshots', () => ({
  signCartScreenshotPathsBatch: mockSignBatch,
}))

import { GET } from '@/app/api/orders/route'

const USER_ID = '00000000-0000-4000-8000-000000000001'

function dbResult(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const mock: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'is', 'order', 'range']) {
    mock[m] = vi.fn(() => mock)
  }
  mock.maybeSingle = vi.fn(() => Promise.resolve(result))
  mock.then = (resolve: (v: typeof result) => void) =>
    Promise.resolve(result).then(resolve)
  return mock
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  mockSignBatch.mockImplementation(async (paths: string[]) => {
    const map = new Map<string, string>()
    for (const p of paths) map.set(p, `https://signed.test/${p}`)
    return map
  })
})

describe('GET /api/orders', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const res = await GET(new NextRequest('http://localhost/api/orders'))
    expect(res.status).toBe(401)
  })

  it('replaces cart_screenshot_urls with signed URLs on every row', async () => {
    const orders = [
      {
        id: 'order-1',
        cart_screenshot_urls: ['pre-checkout/aaa/1.jpg'],
        restaurant_name: 'Chipotle',
      },
      {
        id: 'order-2',
        cart_screenshot_urls: ['pre-checkout/bbb/1.jpg', 'pre-checkout/bbb/2.jpg'],
        restaurant_name: 'Sweetgreen',
      },
    ]
    mockFrom.mockReturnValueOnce(dbResult({ data: orders }))

    const res = await GET(new NextRequest('http://localhost/api/orders'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].cart_screenshot_urls).toEqual(['https://signed.test/pre-checkout/aaa/1.jpg'])
    expect(body[1].cart_screenshot_urls).toEqual([
      'https://signed.test/pre-checkout/bbb/1.jpg',
      'https://signed.test/pre-checkout/bbb/2.jpg',
    ])
  })

  it('handles rows with no screenshots without crashing', async () => {
    const orders = [{ id: 'order-1', cart_screenshot_urls: null, restaurant_name: 'X' }]
    mockFrom.mockReturnValueOnce(dbResult({ data: orders }))
    const res = await GET(new NextRequest('http://localhost/api/orders'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].cart_screenshot_urls).toEqual([])
  })
})
