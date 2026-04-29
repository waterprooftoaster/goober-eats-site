/**
 * @file upload-url.test.ts
 * @description Unit tests for POST /api/cart-screenshots/upload-url —
 *   mints signed upload URLs scoped to a pre-checkout session path layout.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockCreateSignedUploadUrl } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCreateSignedUploadUrl: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser, signOut: vi.fn().mockResolvedValue({ error: null }) },
    // getAuthenticatedUser does a stripe_accounts.suspended SELECT after
    // auth.getUser; return a no-row chain so the suspension gate passes.
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }),
  })),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    storage: {
      from: (bucket: string) => ({
        createSignedUploadUrl: (path: string) => mockCreateSignedUploadUrl(bucket, path),
      }),
    },
  })),
}))

import { POST } from '@/app/api/cart-screenshots/upload-url/route'

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/cart-screenshots/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const AUTH_USER = { id: '00000000-0000-4000-8000-000000000001' }

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
  mockCreateSignedUploadUrl.mockResolvedValue({
    data: {
      signedUrl: 'http://signed.example/upload',
      path: 'placeholder',
      token: 'tok_abc',
    },
    error: null,
  })
})

describe('POST /api/cart-screenshots/upload-url', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const res = await POST(
      buildRequest({ content_type: 'image/png', file_extension: 'png' })
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid body', async () => {
    const res = await POST(buildRequest({ content_type: 'text/plain', file_extension: 'png' }))
    expect(res.status).toBe(400)
  })

  it('rejects unsupported file_extension', async () => {
    const res = await POST(buildRequest({ content_type: 'image/png', file_extension: 'gif' }))
    expect(res.status).toBe(400)
  })

  it('generates a 10-char session_id when none provided', async () => {
    const res = await POST(buildRequest({ content_type: 'image/png', file_extension: 'png' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.session_id).toMatch(/^[A-Za-z0-9_-]{10}$/)
  })

  it('reuses provided session_id', async () => {
    const sessionId = 'ABCdef12_-'
    const res = await POST(
      buildRequest({ session_id: sessionId, content_type: 'image/png', file_extension: 'png' })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.session_id).toBe(sessionId)
  })

  it('builds path as pre-checkout/{session_id}/{uuid}.{ext} and calls signed upload URL', async () => {
    const sessionId = 'ZZZZZZZZZZ'
    await POST(
      buildRequest({ session_id: sessionId, content_type: 'image/jpeg', file_extension: 'jpg' })
    )
    expect(mockCreateSignedUploadUrl).toHaveBeenCalledTimes(1)
    const [bucket, path] = mockCreateSignedUploadUrl.mock.calls[0]
    expect(bucket).toBe('cart-screenshots')
    expect(path).toMatch(
      new RegExp(`^pre-checkout/${sessionId}/[0-9a-f-]{36}\\.jpg$`)
    )
  })

  it('returns the path, signed_url, and token from storage', async () => {
    const res = await POST(
      buildRequest({ content_type: 'image/webp', file_extension: 'webp' })
    )
    const body = await res.json()
    expect(body).toEqual(
      expect.objectContaining({
        session_id: expect.any(String),
        path: expect.stringMatching(/^pre-checkout\/[A-Za-z0-9_-]{10}\/[0-9a-f-]{36}\.webp$/),
        signed_url: 'http://signed.example/upload',
        token: 'tok_abc',
      })
    )
  })

  it('returns 500 when storage fails', async () => {
    mockCreateSignedUploadUrl.mockResolvedValueOnce({
      data: null,
      error: { message: 'storage down' },
    })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST(
      buildRequest({ content_type: 'image/png', file_extension: 'png' })
    )
    expect(res.status).toBe(500)
    consoleSpy.mockRestore()
  })
})
