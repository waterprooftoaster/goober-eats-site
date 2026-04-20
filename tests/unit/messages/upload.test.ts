/**
 * @file upload.test.ts
 * @description Unit tests for the message photo upload route handler (POST /api/messages/upload).
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetAuthenticatedUser, mockFrom, mockStorageBucket } = vi.hoisted(() => ({
  mockGetAuthenticatedUser: vi.fn(),
  mockFrom: vi.fn(),
  mockStorageBucket: {
    upload: vi.fn(),
    getPublicUrl: vi.fn(),
  },
}))

vi.mock('@/lib/api/helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/helpers')>()
  return { ...actual, getAuthenticatedUser: mockGetAuthenticatedUser }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: mockFrom,
      storage: { from: vi.fn().mockReturnValue(mockStorageBucket) },
    })
  ),
}))

import { POST } from '@/app/api/messages/[orderId]/upload/route'

const VALID_ORDER_ID = '00000000-0000-4000-8000-000000000001'
const INVALID_ORDER_ID = 'not-a-uuid'
const MOCK_USER = { id: 'swiper-123' }
const MOCK_CONVERSATION = { id: 'conv-456', swiper_id: MOCK_USER.id }
const MOCK_MESSAGE = {
  id: 'msg-789',
  conversation_id: MOCK_CONVERSATION.id,
  sender_id: MOCK_USER.id,
  body: null,
  message_type: 'delivery_photo',
  image_url: 'https://example.com/delivery-photos/order/uuid.jpg',
  sent_at: new Date().toISOString(),
  expires_at: new Date().toISOString(),
}

function makeFile(type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], 'photo.' + type.split('/')[1], { type })
}

function makeRequest(orderId: string, file?: File): NextRequest {
  const fd = new FormData()
  if (file) fd.append('file', file)
  const req = new NextRequest(`http://localhost/api/messages/${orderId}/upload`, {
    method: 'POST',
  })
  // Override formData so File objects and their MIME types survive in the test environment
  vi.spyOn(req, 'formData').mockResolvedValue(fd)
  return req
}

function makeParams(orderId: string) {
  return { params: Promise.resolve({ orderId }) }
}

function setupHappyPath() {
  mockStorageBucket.upload.mockResolvedValue({ data: { path: 'order/uuid.jpg' }, error: null })
  mockStorageBucket.getPublicUrl.mockReturnValue({
    data: { publicUrl: MOCK_MESSAGE.image_url },
  })

  const mockConvSingle = vi.fn().mockResolvedValue({ data: MOCK_CONVERSATION, error: null })
  const mockMsgSingle = vi.fn().mockResolvedValue({ data: MOCK_MESSAGE, error: null })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'conversations') {
      return { select: () => ({ eq: () => ({ single: mockConvSingle }) }) }
    }
    return { insert: () => ({ select: () => ({ single: mockMsgSingle }) }) }
  })
}

describe('POST /api/messages/[orderId]/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null)
    const res = await POST(makeRequest(VALID_ORDER_ID, makeFile('image/jpeg', 100)), makeParams(VALID_ORDER_ID))
    expect(res.status).toBe(401)
  })

  it('returns 400 when orderId is not a UUID', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    const res = await POST(makeRequest(INVALID_ORDER_ID, makeFile('image/jpeg', 100)), makeParams(INVALID_ORDER_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 when no file is provided', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    const res = await POST(makeRequest(VALID_ORDER_ID), makeParams(VALID_ORDER_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 when file type is not JPEG or WebP', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    const res = await POST(makeRequest(VALID_ORDER_ID, makeFile('image/png', 100)), makeParams(VALID_ORDER_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 when file exceeds 1 MB', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    const oversized = makeFile('image/jpeg', 1024 * 1024 + 1)
    const res = await POST(makeRequest(VALID_ORDER_ID, oversized), makeParams(VALID_ORDER_ID))
    expect(res.status).toBe(400)
  })

  it('returns 404 when conversation not found', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    mockFrom.mockImplementation(() => ({
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
    }))
    const res = await POST(makeRequest(VALID_ORDER_ID, makeFile('image/jpeg', 100)), makeParams(VALID_ORDER_ID))
    expect(res.status).toBe(404)
  })

  it('returns 403 when user is not the swiper', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ id: 'not-the-swiper' })
    const mockConvSingle = vi.fn().mockResolvedValue({ data: MOCK_CONVERSATION, error: null })
    mockFrom.mockImplementation(() => ({
      select: () => ({ eq: () => ({ single: mockConvSingle }) }),
    }))
    const res = await POST(makeRequest(VALID_ORDER_ID, makeFile('image/jpeg', 100)), makeParams(VALID_ORDER_ID))
    expect(res.status).toBe(403)
  })

  it('returns 201 with message on valid JPEG upload', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    setupHappyPath()
    const res = await POST(makeRequest(VALID_ORDER_ID, makeFile('image/jpeg', 100)), makeParams(VALID_ORDER_ID))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toMatchObject({ message_type: 'delivery_photo', image_url: MOCK_MESSAGE.image_url })
  })

  it('returns 201 with message on valid WebP upload', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    setupHappyPath()
    const res = await POST(makeRequest(VALID_ORDER_ID, makeFile('image/webp', 100)), makeParams(VALID_ORDER_ID))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toMatchObject({ message_type: 'delivery_photo' })
  })
})
