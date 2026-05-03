/**
 * @file extract-price.test.ts
 * @description Unit tests for POST /api/orders/extract-price — the server
 *   endpoint that downloads cart screenshots from Storage with the service
 *   client (no orders row exists yet, so RLS can't scope reads) and asks
 *   Gemini for the total and eatery name. Mirrors the mocking pattern in
 *   tests/unit/api/cart-screenshots/sign.test.ts.
 *   Called by: vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// route.ts transitively imports 'server-only' via lib/supabase/service.ts.
vi.mock('server-only', () => ({}))

const {
  mockGetUser,
  mockExtractCartDetails,
  mockServiceDownload,
  mockServiceFrom,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockExtractCartDetails: vi.fn(),
  mockServiceDownload: vi.fn(),
  mockServiceFrom: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser, signOut: vi.fn().mockResolvedValue({ error: null }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }),
  })),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    storage: {
      from: mockServiceFrom,
    },
  }),
}))

vi.mock('@/lib/ai/extract-cart-total', () => ({
  extractCartDetails: mockExtractCartDetails,
}))

import { POST } from '@/app/api/orders/extract-price/route'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const VALID_PATH_A = 'pre-checkout/abcdefghij/00000000-0000-4000-8000-000000000010.png'
const VALID_PATH_B = 'pre-checkout/abcdefghij/00000000-0000-4000-8000-000000000011.jpg'

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/orders/extract-price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function blobOf(bytes: number[]): Blob {
  return new Blob([new Uint8Array(bytes)])
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  mockServiceFrom.mockReturnValue({ download: mockServiceDownload })
  mockServiceDownload.mockImplementation(async () => ({
    data: blobOf([0x89, 0x50, 0x4e, 0x47]),
    error: null,
  }))
  mockExtractCartDetails.mockResolvedValue({ cents: 1234, eatery: 'Jasper Kane' })
})

describe('POST /api/orders/extract-price', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const res = await POST(makeReq({ paths: [VALID_PATH_A] }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when paths is missing', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when paths is empty', async () => {
    const res = await POST(makeReq({ paths: [] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when a path violates the canonical layout', async () => {
    const res = await POST(makeReq({ paths: ['../etc/passwd'] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when more than 5 paths are submitted', async () => {
    const paths = Array.from({ length: 6 }, () => VALID_PATH_A)
    const res = await POST(makeReq({ paths }))
    expect(res.status).toBe(400)
  })

  it('returns 200 with cents and eatery when extraction succeeds', async () => {
    const res = await POST(makeReq({ paths: [VALID_PATH_A] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ cents: 1234, eatery: 'Jasper Kane' })
  })

  it('returns 200 with null fields when the extractor returns nulls', async () => {
    mockExtractCartDetails.mockResolvedValueOnce({ cents: null, eatery: null })
    const res = await POST(makeReq({ paths: [VALID_PATH_A] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ cents: null, eatery: null })
  })

  it('returns 200 with null fields when storage download errors out', async () => {
    mockServiceDownload.mockResolvedValueOnce({
      data: null,
      error: { message: 'not found' },
    })
    const res = await POST(makeReq({ paths: [VALID_PATH_A] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ cents: null, eatery: null })
    expect(mockExtractCartDetails).not.toHaveBeenCalled()
  })

  it('downloads from the cart-screenshots bucket via the service client', async () => {
    await POST(makeReq({ paths: [VALID_PATH_A, VALID_PATH_B] }))
    expect(mockServiceFrom).toHaveBeenCalledWith('cart-screenshots')
    expect(mockServiceDownload).toHaveBeenCalledTimes(2)
    expect(mockServiceDownload).toHaveBeenNthCalledWith(1, VALID_PATH_A)
    expect(mockServiceDownload).toHaveBeenNthCalledWith(2, VALID_PATH_B)
  })

  it('passes the downloaded bytes to the extractor in input order', async () => {
    mockServiceDownload
      .mockResolvedValueOnce({ data: blobOf([1, 2, 3]), error: null })
      .mockResolvedValueOnce({ data: blobOf([4, 5, 6]), error: null })

    await POST(makeReq({ paths: [VALID_PATH_A, VALID_PATH_B] }))
    expect(mockExtractCartDetails).toHaveBeenCalledTimes(1)
    const bytes = mockExtractCartDetails.mock.calls[0][0] as Uint8Array[]
    expect(bytes).toHaveLength(2)
    expect(Array.from(bytes[0])).toEqual([1, 2, 3])
    expect(Array.from(bytes[1])).toEqual([4, 5, 6])
  })
})
