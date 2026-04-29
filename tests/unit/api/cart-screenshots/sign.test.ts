/**
 * @file sign.test.ts
 * @description Unit tests for POST /api/cart-screenshots/sign — the
 *   server-side bridge that lets the /checkout preview get signed URLs for
 *   paths whose owning order row doesn't exist yet (so client-side RLS
 *   denies). Verifies auth gating, schema validation, and helper wiring.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockSignCartScreenshotPaths } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockSignCartScreenshotPaths: vi.fn(),
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

vi.mock('@/lib/storage/sign-screenshots', () => ({
  signCartScreenshotPaths: mockSignCartScreenshotPaths,
}))

import { POST } from '@/app/api/cart-screenshots/sign/route'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const VALID_PATH = 'pre-checkout/abcdefghij/00000000-0000-4000-8000-000000000010.png'

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/cart-screenshots/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  mockSignCartScreenshotPaths.mockImplementation(async (paths: string[]) =>
    paths.map((p) => `https://signed.test/${p}`)
  )
})

describe('POST /api/cart-screenshots/sign', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const res = await POST(makeReq({ paths: [VALID_PATH] }))
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
    const paths = Array.from({ length: 6 }, () => VALID_PATH)
    const res = await POST(makeReq({ paths }))
    expect(res.status).toBe(400)
  })

  it('signs the paths via the helper and returns the URLs in order', async () => {
    const res = await POST(makeReq({ paths: [VALID_PATH] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.signed_urls).toEqual([`https://signed.test/${VALID_PATH}`])
    expect(mockSignCartScreenshotPaths).toHaveBeenCalledWith([VALID_PATH])
  })
})
