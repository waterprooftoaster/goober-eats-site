/**
 * @file upload.test.ts
 * @description Unit tests for the message photo upload route handler (POST /api/messages/upload).
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetAuthenticatedUser, mockFrom, mockStorageBucket, mockSignCompletionPhotoPath, mockMessageInsert } = vi.hoisted(() => ({
  mockGetAuthenticatedUser: vi.fn(),
  mockFrom: vi.fn(),
  mockStorageBucket: {
    upload: vi.fn(),
    getPublicUrl: vi.fn(),
  },
  mockSignCompletionPhotoPath: vi.fn(),
  mockMessageInsert: vi.fn(),
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

vi.mock('@/lib/storage/sign-screenshots', () => ({
  signCompletionPhotoPath: mockSignCompletionPhotoPath,
}))

import { POST } from '@/app/api/messages/[orderId]/upload/route'

const VALID_ORDER_ID = '00000000-0000-4000-8000-000000000001'
const INVALID_ORDER_ID = 'not-a-uuid'
const MOCK_USER = { id: 'swiper-123' }
const MOCK_CONVERSATION = { id: 'conv-456', swiper_id: MOCK_USER.id }
const STORED_PATH_PREFIX = `${VALID_ORDER_ID}/`
const SIGNED_URL = 'https://signed.test/completion-photos/order/uuid.jpg'
const MOCK_MESSAGE = {
  id: 'msg-789',
  conversation_id: MOCK_CONVERSATION.id,
  sender_id: MOCK_USER.id,
  body: null,
  message_type: 'completion_photo',
  image_url: 'will-be-replaced-by-test',
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
  mockSignCompletionPhotoPath.mockImplementation(async (path: string) => `https://signed.test/${path}`)

  const mockConvSingle = vi.fn().mockResolvedValue({ data: MOCK_CONVERSATION, error: null })
  const mockMsgSingle = vi.fn().mockImplementation(async () => ({
    data: { ...MOCK_MESSAGE, image_url: mockMessageInsert.mock.calls[0]?.[0]?.image_url ?? null },
    error: null,
  }))

  mockFrom.mockImplementation((table: string) => {
    if (table === 'conversations') {
      return { select: () => ({ eq: () => ({ single: mockConvSingle }) }) }
    }
    return { insert: (payload: unknown) => {
      mockMessageInsert(payload)
      return { select: () => ({ single: mockMsgSingle }) }
    } }
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

  it('returns 400 when file type is not an allowed image format', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    const res = await POST(makeRequest(VALID_ORDER_ID, makeFile('application/pdf', 100)), makeParams(VALID_ORDER_ID))
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

  it('stores the storage path on the message row and returns a signed URL', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    setupHappyPath()
    const res = await POST(makeRequest(VALID_ORDER_ID, makeFile('image/jpeg', 100)), makeParams(VALID_ORDER_ID))
    expect(res.status).toBe(201)
    const json = await res.json()

    // The DB row gets the raw storage path (not a URL), e.g. `${orderId}/<uuid>.jpg`
    const insertedPayload = mockMessageInsert.mock.calls[0][0] as { image_url: string }
    expect(insertedPayload.image_url).toMatch(new RegExp(`^${STORED_PATH_PREFIX}.+\\.jpg$`))
    expect(insertedPayload.image_url).not.toMatch(/^https?:/)

    // The response carries a signed URL (so the chat can render it)
    expect(json.image_url).toMatch(/^https:\/\/signed\.test\//)
    expect(mockSignCompletionPhotoPath).toHaveBeenCalledWith(insertedPayload.image_url)
    // Suppress unused warning for the constant kept for documentation
    void SIGNED_URL
  })

  it('returns 201 with message on valid WebP upload', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    setupHappyPath()
    const res = await POST(makeRequest(VALID_ORDER_ID, makeFile('image/webp', 100)), makeParams(VALID_ORDER_ID))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toMatchObject({ message_type: 'completion_photo' })
    const insertedPayload = mockMessageInsert.mock.calls[0][0] as { image_url: string }
    expect(insertedPayload.image_url).toMatch(/\.webp$/)
  })
})
