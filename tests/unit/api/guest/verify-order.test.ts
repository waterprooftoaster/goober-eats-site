/**
 * @file verify-order.test.ts
 * @description Unit tests for the GET /api/guest/verify-order route handler.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks — hoisted
// ---------------------------------------------------------------------------
const { mockServiceFrom } = vi.hoisted(() => ({
  mockServiceFrom: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom })),
}))

// ---------------------------------------------------------------------------
// Import handler AFTER mocks
// ---------------------------------------------------------------------------
import { GET } from '@/app/api/guest/verify-order/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_PI_ID = 'pi_test_abc123'
const VALID_ORDER_ID = '00000000-0000-4000-8000-000000000001'
const VALID_TOKEN = '11111111-0000-4000-8000-000000000001'

function dbResult(data: unknown, error: unknown = null) {
  const mock: Record<string, unknown> = {}
  for (const m of ['select', 'eq']) mock[m] = vi.fn(() => mock)
  mock.maybeSingle = vi.fn(() => Promise.resolve({ data, error }))
  mock.single = vi.fn(() => Promise.resolve({ data, error }))
  return mock
}

function makeRequest(piId?: string): NextRequest {
  const url = piId
    ? `http://localhost/api/guest/verify-order?pi_id=${piId}`
    : 'http://localhost/api/guest/verify-order'
  return new NextRequest(url, { method: 'GET' })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  mockServiceFrom.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/guest/verify-order', () => {
  it('returns 400 when pi_id is missing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/pi_id/)
  })

  it('returns 400 when pi_id format is invalid', async () => {
    const res = await GET(makeRequest('cs_not_a_pi_id'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid/i)
  })

  it('redirects with httpOnly cookie on success', async () => {
    mockServiceFrom.mockReturnValueOnce(
      dbResult({ id: VALID_ORDER_ID, guest_access_token: VALID_TOKEN })
    )

    const res = await GET(makeRequest(VALID_PI_ID))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain(`/order/${VALID_ORDER_ID}`)

    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain(`guest_order_token_${VALID_ORDER_ID}`)
    expect(setCookie).toContain(VALID_TOKEN)
    expect(setCookie).toContain('HttpOnly')
    // Cookie path must be / so the browser sends it to /api/guest/orders/[orderId]
    // and /api/messages/[orderId]. A narrow path like /order/guest/{id} would
    // silently drop the cookie on API calls → 401.
    expect(setCookie).toMatch(/Path=\/\s*(;|$)/)
    expect(setCookie).not.toContain('/order/guest/')
  })

  it('renders a waiting HTML page with meta-refresh when the order is not yet in DB', async () => {
    mockServiceFrom.mockReturnValueOnce(dbResult(null))

    const res = await GET(makeRequest(VALID_PI_ID))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const html = await res.text()
    // Browser-driven retry — meta refresh back to the same endpoint
    expect(html).toMatch(/<meta\s+http-equiv=["']refresh["']/i)
    expect(html).toContain(`pi_id=${VALID_PI_ID}`)
    // Server function must NOT loop — exactly one DB hit per call
    expect(mockServiceFrom).toHaveBeenCalledTimes(1)
  })

  it('does not set the guest cookie on the waiting page', async () => {
    mockServiceFrom.mockReturnValueOnce(dbResult(null))

    const res = await GET(makeRequest(VALID_PI_ID))
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('returns 500 when Supabase query errors', async () => {
    mockServiceFrom.mockReturnValue(
      dbResult(null, { message: 'permission denied', code: '42501' })
    )

    const res = await GET(makeRequest(VALID_PI_ID))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/failed to verify/i)
  })

  it('returns 403 when order exists but is not a guest order', async () => {
    mockServiceFrom.mockReturnValueOnce(
      dbResult({ id: VALID_ORDER_ID, guest_access_token: null })
    )

    const res = await GET(makeRequest(VALID_PI_ID))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/not a guest order/i)
    expect(mockServiceFrom).toHaveBeenCalledTimes(1)
  })
})
