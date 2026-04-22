/**
 * @file messages-post.test.ts
 * @description Unit tests for the POST /api/guest/messages route handler.
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
import { POST } from '@/app/api/guest/messages/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_ORDER_ID = '00000000-0000-4000-8000-000000000001'
const VALID_TOKEN = '11111111-0000-4000-8000-000000000001'
const CONV_ID = '22222222-0000-4000-8000-000000000001'

function dbResult(data: unknown, error: unknown = null) {
  const mock: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'eq']) mock[m] = vi.fn(() => mock)
  mock.maybeSingle = vi.fn(() => Promise.resolve({ data, error }))
  mock.single = vi.fn(() => Promise.resolve({ data, error }))
  return mock
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/guest/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function setupValidAuth() {
  mockCookiesGet.mockReturnValue({ value: VALID_TOKEN })
  mockServiceFrom.mockReturnValueOnce(
    dbResult({ id: VALID_ORDER_ID, guest_access_token: VALID_TOKEN, orderer_id: null })
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  // mockReturnValueOnce queues survive clearAllMocks — reset explicitly
  mockServiceFrom.mockReset()
  mockCookiesGet.mockReset()
})

describe('POST /api/guest/messages', () => {
  it('returns 401 when cookie is absent', async () => {
    mockCookiesGet.mockReturnValue(undefined)
    mockServiceFrom.mockReturnValueOnce(
      dbResult({ id: VALID_ORDER_ID, guest_access_token: VALID_TOKEN, orderer_id: null })
    )

    const res = await POST(makeRequest({ order_id: VALID_ORDER_ID, body: 'hello' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when token does not match', async () => {
    mockCookiesGet.mockReturnValue({ value: 'wrong-token' })
    mockServiceFrom.mockReturnValueOnce(
      dbResult({ id: VALID_ORDER_ID, guest_access_token: VALID_TOKEN, orderer_id: null })
    )

    const res = await POST(makeRequest({ order_id: VALID_ORDER_ID, body: 'hello' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when body is missing', async () => {
    setupValidAuth()
    const res = await POST(makeRequest({ order_id: VALID_ORDER_ID }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body exceeds 1000 chars', async () => {
    setupValidAuth()
    const res = await POST(makeRequest({ order_id: VALID_ORDER_ID, body: 'a'.repeat(1001) }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when message_type is completion_photo', async () => {
    setupValidAuth()
    const res = await POST(makeRequest({ order_id: VALID_ORDER_ID, body: 'photo', message_type: 'completion_photo' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when conversation is not found', async () => {
    setupValidAuth()
    mockServiceFrom.mockReturnValueOnce(dbResult(null)) // conversations → not found

    const res = await POST(makeRequest({ order_id: VALID_ORDER_ID, body: 'hello' }))
    expect(res.status).toBe(404)
  })

  it('returns 201 with message; sender_id is null for guest messages', async () => {
    setupValidAuth()

    const conv = { id: CONV_ID }
    const mockMsg = {
      id: 'msg-new',
      conversation_id: CONV_ID,
      sender_id: null,
      body: 'hello',
      message_type: 'text',
      sent_at: new Date().toISOString(),
      expires_at: new Date().toISOString(),
      image_url: null,
    }
    const convChain = dbResult(conv)
    const msgChain = dbResult(mockMsg)

    mockServiceFrom
      .mockReturnValueOnce(convChain)
      .mockReturnValueOnce(msgChain)

    const res = await POST(makeRequest({ order_id: VALID_ORDER_ID, body: 'hello' }))
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body).toMatchObject({ id: 'msg-new', sender_id: null })

    // Assert insert was called with sender_id: null
    expect(msgChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ sender_id: null, body: 'hello' })
    )
  })

  it('defaults message_type to text', async () => {
    setupValidAuth()

    const conv = { id: CONV_ID }
    const mockMsg = {
      id: 'msg-new', conversation_id: CONV_ID, sender_id: null, body: 'hi',
      message_type: 'text', sent_at: new Date().toISOString(),
      expires_at: new Date().toISOString(), image_url: null,
    }
    mockServiceFrom
      .mockReturnValueOnce(dbResult(conv))
      .mockReturnValueOnce(dbResult(mockMsg))

    const res = await POST(makeRequest({ order_id: VALID_ORDER_ID, body: 'hi' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.message_type).toBe('text')
  })
})
