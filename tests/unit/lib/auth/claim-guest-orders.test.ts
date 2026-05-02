/**
 * @file claim-guest-orders.test.ts
 * @description Unit specs for the lib/auth/claim-guest-orders helper:
 *   walks guest_order_token_* cookies, validates each token against
 *   `orders.guest_access_token`, service-client-updates orders +
 *   conversations to bind to the new userId, and is idempotent + race-safe
 *   via .is('orderer_id', null).
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// `claim-guest-orders` imports `server-only`, which throws under vitest's
// jsdom env. Stub it to a no-op so the module loads in tests.
vi.mock('server-only', () => ({}))

// ---------------------------------------------------------------------------
// Mocks — hoisted
// ---------------------------------------------------------------------------
const {
  mockCookieStore,
  mockOrdersSelect,
  mockOrdersUpdate,
  mockConvUpdate,
  mockServiceClient,
} = vi.hoisted(() => {
  const mockCookieStore = {
    getAll: vi.fn(),
    set: vi.fn(),
  }
  const mockOrdersSelect = vi.fn()
  const mockOrdersUpdate = vi.fn()
  const mockConvUpdate = vi.fn()

  const mockServiceClient = {
    from: vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            in: () => ({
              is: () => mockOrdersSelect(),
            }),
          }),
          update: (patch: unknown) => ({
            eq: (_col: string, _id: string) => ({
              is: () => mockOrdersUpdate(patch, _id),
            }),
          }),
        }
      }
      if (table === 'conversations') {
        return {
          update: (patch: unknown) => ({
            eq: (_col: string, _orderId: string) => mockConvUpdate(patch, _orderId),
          }),
        }
      }
      return {}
    }),
  }

  return {
    mockCookieStore,
    mockOrdersSelect,
    mockOrdersUpdate,
    mockConvUpdate,
    mockServiceClient,
  }
})

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(mockCookieStore),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockServiceClient,
}))

// Import AFTER mocks
import { claimGuestOrders, clearGuestOrderCookies } from '@/lib/auth/claim-guest-orders'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const USER_ID = '99999999-0000-4000-8000-000000000001'
const ORDER_A = 'aaaaaaaa-0000-4000-8000-000000000001'
const ORDER_B = 'bbbbbbbb-0000-4000-8000-000000000001'
// Tokens are UUIDs in the schema; the helper now rejects non-UUID values up
// front so test fixtures must use valid UUIDs.
const TOKEN_A = 'cccccccc-0000-4000-8000-000000000001'
const TOKEN_B = 'dddddddd-0000-4000-8000-000000000001'

beforeEach(() => {
  vi.clearAllMocks()
  // Default: empty cookies, empty SELECT, no errors.
  mockCookieStore.getAll.mockReturnValue([])
  mockOrdersSelect.mockResolvedValue({ data: [], error: null })
  mockOrdersUpdate.mockResolvedValue({ error: null })
  mockConvUpdate.mockResolvedValue({ error: null })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('claimGuestOrders', () => {
  it('no-ops when there are no guest_order_token_* cookies', async () => {
    mockCookieStore.getAll.mockReturnValue([
      { name: 'sb-auth-token', value: 'irrelevant' },
      { name: 'guest_session_id', value: 'irrelevant' },
    ])

    const result = await claimGuestOrders(USER_ID)

    expect(result).toEqual({ claimedOrderIds: [] })
    expect(mockOrdersSelect).not.toHaveBeenCalled()
    expect(mockOrdersUpdate).not.toHaveBeenCalled()
    expect(mockConvUpdate).not.toHaveBeenCalled()
  })

  it('returns empty + no DB writes when userId is not a UUID', async () => {
    mockCookieStore.getAll.mockReturnValue([
      { name: `guest_order_token_${ORDER_A}`, value: TOKEN_A },
    ])

    const result = await claimGuestOrders('not-a-uuid')

    expect(result).toEqual({ claimedOrderIds: [] })
    expect(mockOrdersSelect).not.toHaveBeenCalled()
    expect(mockOrdersUpdate).not.toHaveBeenCalled()
  })

  it('drops cookies whose orderId is not a UUID', async () => {
    mockCookieStore.getAll.mockReturnValue([
      { name: 'guest_order_token_not-a-uuid', value: TOKEN_A },
    ])

    const result = await claimGuestOrders(USER_ID)

    expect(result).toEqual({ claimedOrderIds: [] })
    // No SELECT issued because there were no valid candidates.
    expect(mockOrdersSelect).not.toHaveBeenCalled()
  })

  it('claims a single matching order: updates orders + conversations and returns the id', async () => {
    mockCookieStore.getAll.mockReturnValue([
      { name: `guest_order_token_${ORDER_A}`, value: TOKEN_A },
    ])
    mockOrdersSelect.mockResolvedValue({
      data: [{ id: ORDER_A, guest_access_token: TOKEN_A, orderer_id: null }],
      error: null,
    })

    const result = await claimGuestOrders(USER_ID)

    expect(result).toEqual({ claimedOrderIds: [ORDER_A] })
    expect(mockOrdersUpdate).toHaveBeenCalledWith(
      {
        orderer_id: USER_ID,
        guest_access_token: null,
        anon_user_id: null,
      },
      ORDER_A
    )
    expect(mockConvUpdate).toHaveBeenCalledWith({ orderer_id: USER_ID }, ORDER_A)
  })

  it('skips a row where the cookie token does NOT match the DB token', async () => {
    mockCookieStore.getAll.mockReturnValue([
      { name: `guest_order_token_${ORDER_A}`, value: 'wrong-token' },
    ])
    mockOrdersSelect.mockResolvedValue({
      data: [{ id: ORDER_A, guest_access_token: TOKEN_A, orderer_id: null }],
      error: null,
    })

    const result = await claimGuestOrders(USER_ID)

    expect(result).toEqual({ claimedOrderIds: [] })
    expect(mockOrdersUpdate).not.toHaveBeenCalled()
    expect(mockConvUpdate).not.toHaveBeenCalled()
  })

  it('skips already-claimed rows (orderer_id non-null) — handled by .is(orderer_id, null) filter', async () => {
    mockCookieStore.getAll.mockReturnValue([
      { name: `guest_order_token_${ORDER_A}`, value: TOKEN_A },
    ])
    // Service returns no rows because the .is() filter excluded the claimed one.
    mockOrdersSelect.mockResolvedValue({ data: [], error: null })

    const result = await claimGuestOrders(USER_ID)

    expect(result).toEqual({ claimedOrderIds: [] })
    expect(mockOrdersUpdate).not.toHaveBeenCalled()
  })

  it('claims the matching subset when multiple cookies are present (one good, one mismatched)', async () => {
    mockCookieStore.getAll.mockReturnValue([
      { name: `guest_order_token_${ORDER_A}`, value: TOKEN_A },
      { name: `guest_order_token_${ORDER_B}`, value: 'wrong-token' },
    ])
    mockOrdersSelect.mockResolvedValue({
      data: [
        { id: ORDER_A, guest_access_token: TOKEN_A, orderer_id: null },
        { id: ORDER_B, guest_access_token: TOKEN_B, orderer_id: null },
      ],
      error: null,
    })

    const result = await claimGuestOrders(USER_ID)

    expect(result).toEqual({ claimedOrderIds: [ORDER_A] })
    // Only ORDER_A's update should have fired.
    expect(mockOrdersUpdate.mock.calls.map((c) => c[1])).toEqual([ORDER_A])
    expect(mockConvUpdate.mock.calls.map((c) => c[1])).toEqual([ORDER_A])
  })

  it('returns empty and writes nothing when the SELECT errors', async () => {
    mockCookieStore.getAll.mockReturnValue([
      { name: `guest_order_token_${ORDER_A}`, value: TOKEN_A },
    ])
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockOrdersSelect.mockResolvedValue({ data: null, error: { message: 'db error' } })

    const result = await claimGuestOrders(USER_ID)

    expect(result).toEqual({ claimedOrderIds: [] })
    expect(mockOrdersUpdate).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('does NOT claim when the conversation update errors first (preserves guest cookie path for retry)', async () => {
    mockCookieStore.getAll.mockReturnValue([
      { name: `guest_order_token_${ORDER_A}`, value: TOKEN_A },
    ])
    mockOrdersSelect.mockResolvedValue({
      data: [{ id: ORDER_A, guest_access_token: TOKEN_A, orderer_id: null }],
      error: null,
    })
    mockConvUpdate.mockResolvedValue({ error: { message: 'conversation row missing' } })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await claimGuestOrders(USER_ID)

    expect(result).toEqual({ claimedOrderIds: [] })
    // The order update must NOT have run — guest_access_token must remain
    // intact so the cookie still validates on the next sign-in attempt.
    expect(mockOrdersUpdate).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('drops a claimed id when the order update itself errors (after conversation succeeded)', async () => {
    mockCookieStore.getAll.mockReturnValue([
      { name: `guest_order_token_${ORDER_A}`, value: TOKEN_A },
    ])
    mockOrdersSelect.mockResolvedValue({
      data: [{ id: ORDER_A, guest_access_token: TOKEN_A, orderer_id: null }],
      error: null,
    })
    mockOrdersUpdate.mockResolvedValue({ error: { message: 'rls denial' } })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await claimGuestOrders(USER_ID)

    expect(result).toEqual({ claimedOrderIds: [] })
    // Conversation was updated first (idempotent); order update failed second.
    expect(mockConvUpdate).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('drops a token cookie whose value is not a UUID', async () => {
    mockCookieStore.getAll.mockReturnValue([
      { name: `guest_order_token_${ORDER_A}`, value: 'not-a-uuid-token' },
    ])

    const result = await claimGuestOrders(USER_ID)

    expect(result).toEqual({ claimedOrderIds: [] })
    expect(mockOrdersSelect).not.toHaveBeenCalled()
  })
})

describe('clearGuestOrderCookies', () => {
  it('clears each provided order cookie with maxAge=0', async () => {
    await clearGuestOrderCookies([ORDER_A, ORDER_B])

    expect(mockCookieStore.set).toHaveBeenCalledTimes(2)
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      `guest_order_token_${ORDER_A}`,
      '',
      expect.objectContaining({ maxAge: 0, path: '/' })
    )
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      `guest_order_token_${ORDER_B}`,
      '',
      expect.objectContaining({ maxAge: 0, path: '/' })
    )
  })

  it('is a no-op when given an empty array', async () => {
    await clearGuestOrderCookies([])
    expect(mockCookieStore.set).not.toHaveBeenCalled()
  })
})
