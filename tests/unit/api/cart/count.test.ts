import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — hoisted
// ---------------------------------------------------------------------------
const { mockServiceFrom, mockCookiesGet, mockGetAuthenticatedUser } = vi.hoisted(() => ({
  mockServiceFrom: vi.fn(),
  mockCookiesGet: vi.fn(),
  mockGetAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({})),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ get: mockCookiesGet })),
}))

vi.mock('@/lib/api/helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/helpers')>()
  return { ...actual, getAuthenticatedUser: mockGetAuthenticatedUser }
})

// ---------------------------------------------------------------------------
// Import handler AFTER mocks
// ---------------------------------------------------------------------------
import { GET } from '@/app/api/cart/count/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SESSION_ID = 'test-session-id'
const CART_ID = 'cart-abc'
const MOCK_USER = { id: 'user-123' }

function dbResult(data: unknown, error: unknown = null) {
  const mock: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order']) mock[m] = vi.fn(() => mock)
  mock.maybeSingle = vi.fn(() => Promise.resolve({ data, error }))
  mock.single = vi.fn(() => Promise.resolve({ data, error }))
  mock.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data, error }).then(resolve)
  return mock
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  mockServiceFrom.mockReset()
  mockCookiesGet.mockReset()
  mockGetAuthenticatedUser.mockReset()
})

describe('GET /api/cart/count', () => {
  it('returns { count: 0 } when unauthenticated and no session cookie', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null)
    mockCookiesGet.mockReturnValue(undefined)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(0)
  })

  it('returns { count: 0 } when guest session cookie exists but no matching cart', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null)
    mockCookiesGet.mockReturnValue({ value: SESSION_ID })
    mockServiceFrom.mockReturnValueOnce(dbResult(null)) // carts query returns no cart

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(0)
  })

  it('returns { count: 0 } when authenticated user has no cart', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    mockServiceFrom.mockReturnValueOnce(dbResult(null)) // carts query returns no cart

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(0)
  })

  it('returns { count: 0 } when cart exists but cart_items is empty', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    mockServiceFrom.mockReturnValueOnce(dbResult({ id: CART_ID }))  // cart found
    mockServiceFrom.mockReturnValueOnce(dbResult([]))                 // cart_items empty

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(0)
  })

  it('returns { count: 0 } when cart_items query returns null', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    mockServiceFrom.mockReturnValueOnce(dbResult({ id: CART_ID }))
    mockServiceFrom.mockReturnValueOnce(dbResult(null)) // data is null

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(0)
  })

  it('returns correct quantity sum for guest user', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null)
    mockCookiesGet.mockReturnValue({ value: SESSION_ID })
    mockServiceFrom.mockReturnValueOnce(dbResult({ id: CART_ID }))
    mockServiceFrom.mockReturnValueOnce(dbResult([{ quantity: 2 }, { quantity: 3 }]))

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(5)
  })

  it('returns correct quantity sum for authenticated user', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_USER)
    mockServiceFrom.mockReturnValueOnce(dbResult({ id: CART_ID }))
    mockServiceFrom.mockReturnValueOnce(dbResult([{ quantity: 1 }, { quantity: 1 }, { quantity: 1 }]))

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(3)
  })

  it('uses session_id path (not user_id) when getAuthenticatedUser returns null', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null)
    mockCookiesGet.mockReturnValue({ value: SESSION_ID })
    mockServiceFrom.mockReturnValueOnce(dbResult(null))

    await GET()

    // The carts query should have used eq('session_id', SESSION_ID) — not eq('user_id', ...)
    // We verify by checking mockServiceFrom was called (guest path) and cookie was read
    expect(mockCookiesGet).toHaveBeenCalledWith('cart_session_id')
    // If user path ran, mockServiceFrom would be called with eq('user_id', ...) first — but
    // since user is null the session path runs, so from('carts') is called exactly once
    expect(mockServiceFrom).toHaveBeenCalledTimes(1)
    expect(mockServiceFrom).toHaveBeenCalledWith('carts')
  })
})
