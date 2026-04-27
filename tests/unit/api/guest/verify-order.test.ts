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
  vi.useFakeTimers()
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

  it('returns 404 when no order found for that pi_id', async () => {
    mockServiceFrom.mockReturnValue(dbResult(null))

    const p = GET(makeRequest(VALID_PI_ID))
    await vi.runAllTimersAsync()
    const res = await p
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/not found/i)
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

  it('does not set cookie when order is not found', async () => {
    mockServiceFrom.mockReturnValue(dbResult(null))

    const p = GET(makeRequest(VALID_PI_ID))
    await vi.runAllTimersAsync()
    const res = await p
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('retries and succeeds when order appears on 2nd attempt', async () => {
    mockServiceFrom
      .mockReturnValueOnce(dbResult(null))
      .mockReturnValue(dbResult({ id: VALID_ORDER_ID, guest_access_token: VALID_TOKEN }))

    const p = GET(makeRequest(VALID_PI_ID))
    await vi.runAllTimersAsync()
    const res = await p

    expect(res.status).toBe(307)
    expect(mockServiceFrom).toHaveBeenCalledTimes(2)
  })

  it('queries DB MAX_ATTEMPTS times before returning 404', async () => {
    mockServiceFrom.mockReturnValue(dbResult(null))

    const p = GET(makeRequest(VALID_PI_ID))
    await vi.runAllTimersAsync()
    const res = await p

    expect(res.status).toBe(404)
    expect(mockServiceFrom).toHaveBeenCalledTimes(5)
  })

  it('returns 500 immediately when Supabase query errors', async () => {
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

  it('does not retry when Supabase returns a query error', async () => {
    mockServiceFrom.mockReturnValue(
      dbResult(null, { message: 'permission denied', code: '42501' })
    )

    await GET(makeRequest(VALID_PI_ID))
    expect(mockServiceFrom).toHaveBeenCalledTimes(1)
  })
})
