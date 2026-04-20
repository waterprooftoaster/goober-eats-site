/**
 * @file messages-get.test.ts
 * @description Unit tests for the GET /api/guest/messages route handler.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks — hoisted
// ---------------------------------------------------------------------------
const { mockServiceFrom, mockCookiesGet } = vi.hoisted(() => ({
  mockServiceFrom: vi.fn(),
  mockCookiesGet: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom })),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ get: mockCookiesGet })),
}))

// ---------------------------------------------------------------------------
// Import handler AFTER mocks
// ---------------------------------------------------------------------------
import { GET } from '@/app/api/guest/messages/[orderId]/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_ORDER_ID = '00000000-0000-4000-8000-000000000001'
const VALID_TOKEN = '11111111-0000-4000-8000-000000000001'
const CONV_ID = '22222222-0000-4000-8000-000000000001'

function dbResult(data: unknown, error: unknown = null) {
  const mock: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order']) mock[m] = vi.fn(() => mock)
  mock.maybeSingle = vi.fn(() => Promise.resolve({ data, error }))
  mock.single = vi.fn(() => Promise.resolve({ data, error }))
  mock.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data, error }).then(resolve)
  return mock
}

function makeRequest(orderId: string): NextRequest {
  return new NextRequest(`http://localhost/api/guest/messages/${orderId}`, { method: 'GET' })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  // mockReturnValueOnce queues survive clearAllMocks — reset explicitly to
  // prevent unconsumed values from leaking into subsequent tests
  mockServiceFrom.mockReset()
  mockCookiesGet.mockReset()
})

describe('GET /api/guest/messages/[orderId]', () => {
  it('returns 400 for invalid UUID', async () => {
    mockCookiesGet.mockReturnValue({ value: VALID_TOKEN })
    const res = await GET(makeRequest('not-a-uuid'), { params: Promise.resolve({ orderId: 'not-a-uuid' }) })
    expect(res.status).toBe(400)
  })

  it('returns 401 when cookie is absent', async () => {
    mockCookiesGet.mockReturnValue(undefined)
    mockServiceFrom.mockReturnValueOnce(
      dbResult({ id: VALID_ORDER_ID, guest_access_token: VALID_TOKEN, orderer_id: null })
    )

    const res = await GET(makeRequest(VALID_ORDER_ID), { params: Promise.resolve({ orderId: VALID_ORDER_ID }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 when cookie token does not match', async () => {
    mockCookiesGet.mockReturnValue({ value: 'wrong-token' })
    mockServiceFrom.mockReturnValueOnce(
      dbResult({ id: VALID_ORDER_ID, guest_access_token: VALID_TOKEN, orderer_id: null })
    )

    const res = await GET(makeRequest(VALID_ORDER_ID), { params: Promise.resolve({ orderId: VALID_ORDER_ID }) })
    expect(res.status).toBe(403)
  })

  it('returns 403 when order belongs to an authenticated user', async () => {
    mockCookiesGet.mockReturnValue({ value: VALID_TOKEN })
    mockServiceFrom.mockReturnValueOnce(
      dbResult({ id: VALID_ORDER_ID, guest_access_token: VALID_TOKEN, orderer_id: 'some-user-id' })
    )

    const res = await GET(makeRequest(VALID_ORDER_ID), { params: Promise.resolve({ orderId: VALID_ORDER_ID }) })
    expect(res.status).toBe(403)
  })

  it('returns 200 with null conversation when order has no conversation yet', async () => {
    mockCookiesGet.mockReturnValue({ value: VALID_TOKEN })
    // validateGuestOrder fetch
    mockServiceFrom.mockReturnValueOnce(
      dbResult({ id: VALID_ORDER_ID, guest_access_token: VALID_TOKEN, orderer_id: null })
    )
    // orders status query (Promise.all slot 1)
    mockServiceFrom.mockReturnValueOnce(dbResult({ status: 'open' }))
    // conversations fetch → none found (Promise.all slot 2)
    mockServiceFrom.mockReturnValueOnce(dbResult(null))

    const res = await GET(makeRequest(VALID_ORDER_ID), { params: Promise.resolve({ orderId: VALID_ORDER_ID }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.conversation).toBeNull()
    expect(body.messages).toEqual([])
    expect(body.order_status).toBe('open')
  })

  it('returns 200 with conversation and messages when both exist', async () => {
    mockCookiesGet.mockReturnValue({ value: VALID_TOKEN })
    const conv = { id: CONV_ID, order_id: VALID_ORDER_ID, orderer_id: null, swiper_id: 'swiper-1', created_at: new Date().toISOString() }
    const msg = { id: 'msg-1', conversation_id: CONV_ID, sender_id: 'swiper-1', body: 'Hello', message_type: 'text', sent_at: new Date().toISOString(), expires_at: new Date().toISOString(), image_url: null }

    // validateGuestOrder
    mockServiceFrom.mockReturnValueOnce(
      dbResult({ id: VALID_ORDER_ID, guest_access_token: VALID_TOKEN, orderer_id: null })
    )
    // orders status query (Promise.all slot 1)
    mockServiceFrom.mockReturnValueOnce(dbResult({ status: 'accepted' }))
    // conversations (Promise.all slot 2)
    mockServiceFrom.mockReturnValueOnce(dbResult(conv))
    // messages and profiles (Promise.all)
    const msgChain = dbResult([msg])
    mockServiceFrom.mockReturnValueOnce(msgChain)
    // profiles swiper lookup (Promise.all slot 2)
    mockServiceFrom.mockReturnValueOnce(dbResult({ full_name: 'Test Swiper' }))

    const res = await GET(makeRequest(VALID_ORDER_ID), { params: Promise.resolve({ orderId: VALID_ORDER_ID }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.conversation).toMatchObject({ id: CONV_ID, swiper_full_name: 'Test Swiper' })
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0]).toMatchObject({ id: 'msg-1' })
    expect(body.order_status).toBe('accepted')
  })
})
