/**
 * @file post.test.ts
 * @description Unit tests for the POST /api/messages route handler.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetAuthenticatedUser, mockFrom } = vi.hoisted(() => ({
  mockGetAuthenticatedUser: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/api/helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/helpers')>()
  return { ...actual, getAuthenticatedUser: mockGetAuthenticatedUser }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({ from: mockFrom })),
}))

import { POST } from '@/app/api/messages/route'

const VALID_ORDER_ID = '00000000-0000-4000-8000-000000000001'
const MOCK_USER = { id: 'user-123' }
const MOCK_CONVERSATION = { id: 'conv-456' }

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function setupConversationAndMessageMocks(messageOverrides: Record<string, unknown> = {}) {
  const mockConvSingle = vi.fn().mockResolvedValue({ data: MOCK_CONVERSATION, error: null })
  const mockMessage = {
    id: 'msg-789',
    conversation_id: MOCK_CONVERSATION.id,
    sender_id: MOCK_USER.id,
    body: 'hello',
    message_type: 'text',
    sent_at: new Date().toISOString(),
    expires_at: new Date().toISOString(),
    image_url: null,
    ...messageOverrides,
  }
  const mockMsgSingle = vi.fn().mockResolvedValue({ data: mockMessage, error: null })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'conversations') {
      return { select: () => ({ eq: () => ({ single: mockConvSingle }) }) }
    }
    return { insert: () => ({ select: () => ({ single: mockMsgSingle }) }) }
  })

  return { mockMessage }
}

describe('POST /api/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null)
    const res = await POST(makeRequest({ order_id: VALID_ORDER_ID, body: 'hello' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is missing', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    const res = await POST(makeRequest({ order_id: VALID_ORDER_ID }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body exceeds 1000 chars', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    const res = await POST(makeRequest({ order_id: VALID_ORDER_ID, body: 'a'.repeat(1001) }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when message_type is completion_photo', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    const res = await POST(makeRequest({
      order_id: VALID_ORDER_ID,
      body: 'a photo',
      message_type: 'completion_photo',
    }))
    expect(res.status).toBe(400)
  })

  it('accepts message_type text and returns 201 with message_type in response', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    const { mockMessage } = setupConversationAndMessageMocks({ message_type: 'text' })

    const res = await POST(makeRequest({
      order_id: VALID_ORDER_ID,
      body: 'hello',
      message_type: 'text',
    }))

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toMatchObject({ message_type: mockMessage.message_type })
  })

  it('accepts message_type system and returns 201', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    setupConversationAndMessageMocks({ body: 'Order accepted', message_type: 'system' })

    const res = await POST(makeRequest({
      order_id: VALID_ORDER_ID,
      body: 'Order accepted',
      message_type: 'system',
    }))

    expect(res.status).toBe(201)
  })

  it('defaults to message_type text when not provided', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    const { mockMessage } = setupConversationAndMessageMocks()

    const res = await POST(makeRequest({ order_id: VALID_ORDER_ID, body: 'hello' }))

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toMatchObject({ message_type: mockMessage.message_type })
  })

  it('passes a client-supplied temp_id into the insert payload', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    const TEMP_ID = '33333333-0000-4000-8000-000000000001'
    const insertSpy = vi.fn(() => ({
      select: () => ({
        single: vi.fn().mockResolvedValue({
          data: { id: 'msg-789', temp_id: TEMP_ID, message_type: 'text' },
          error: null,
        }),
      }),
    }))
    const convSingle = vi.fn().mockResolvedValue({ data: MOCK_CONVERSATION, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'conversations') return { select: () => ({ eq: () => ({ single: convSingle }) }) }
      return { insert: insertSpy }
    })

    const res = await POST(makeRequest({ order_id: VALID_ORDER_ID, body: 'hi', temp_id: TEMP_ID }))

    expect(res.status).toBe(201)
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ temp_id: TEMP_ID }))
  })

  it('echoes temp_id back in the response payload', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    const TEMP_ID = '33333333-0000-4000-8000-000000000002'
    setupConversationAndMessageMocks({ temp_id: TEMP_ID })

    const res = await POST(makeRequest({ order_id: VALID_ORDER_ID, body: 'hi', temp_id: TEMP_ID }))

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.temp_id).toBe(TEMP_ID)
  })

  it('inserts temp_id as null when client omits it (existing clients still work)', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    const insertSpy = vi.fn(() => ({
      select: () => ({
        single: vi.fn().mockResolvedValue({
          data: { id: 'msg-789', temp_id: null, message_type: 'text' },
          error: null,
        }),
      }),
    }))
    const convSingle = vi.fn().mockResolvedValue({ data: MOCK_CONVERSATION, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'conversations') return { select: () => ({ eq: () => ({ single: convSingle }) }) }
      return { insert: insertSpy }
    })

    const res = await POST(makeRequest({ order_id: VALID_ORDER_ID, body: 'hi' }))

    expect(res.status).toBe(201)
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ temp_id: null }))
  })

  it('rejects a malformed (non-UUID) temp_id at the schema boundary', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    const res = await POST(makeRequest({ order_id: VALID_ORDER_ID, body: 'hi', temp_id: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })
})
