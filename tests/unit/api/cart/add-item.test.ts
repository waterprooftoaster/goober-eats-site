/**
 * @file add-item.test.ts
 * @description Unit tests for POST /api/cart/items.
 *   Tests both normal option (no linked item) and linked-item option branches.
 *   Called by: vitest run tests/unit/api/cart/add-item.test.ts
 * @dependencies vitest, next/server
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MENU_ITEM_ID    = '00000000-0000-4000-8000-000000000010'
const EATERY_ID       = '00000000-0000-4000-8000-000000000020'
const OPTION_ID       = '00000000-0000-4000-8000-000000000030'
const OPTION_GROUP_ID = '00000000-0000-4000-8000-000000000040'
const CART_ID         = '00000000-0000-4000-8000-000000000050'
const CART_ITEM_ID    = '00000000-0000-4000-8000-000000000060'
const LINKED_ITEM_ID  = '00000000-0000-4000-8000-000000000070'
const SESSION_ID      = '00000000-0000-4000-8000-000000000090'

// ---------------------------------------------------------------------------
// Mocks — hoisted
// ---------------------------------------------------------------------------

const { mockServiceFrom, mockGetAuth, mockGetOrCreate } = vi.hoisted(() => ({
  mockServiceFrom: vi.fn(),
  mockGetAuth: vi.fn(),
  mockGetOrCreate: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom })),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({})),
}))

vi.mock('@/lib/api/helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/helpers')>()
  return {
    ...actual,
    getAuthenticatedUser: (...args: unknown[]) => mockGetAuth(...args),
    getOrCreateSessionId: (...args: unknown[]) => mockGetOrCreate(...args),
  }
})

// Import AFTER mocks
import { POST } from '@/app/api/cart/items/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a query chain mock that ends in `result` for terminal calls.
 * @param result - final resolved value
 * @returns chainable mock
 */
function dbChain(result: { data?: unknown; error?: unknown | null } = { data: null, error: null }) {
  const mock: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'in', 'is', 'maybeSingle']) {
    mock[m] = vi.fn(() => mock)
  }
  mock.single = vi.fn(() => Promise.resolve(result))
  mock.maybeSingle = vi.fn(() => Promise.resolve(result))
  // thenability for insert/delete without a terminal call
  mock.then = (resolve: (v: typeof result) => void) => Promise.resolve(result).then(resolve)
  return mock
}

/**
 * Builds a POST request to /api/cart/items with the given body.
 * @param body - request body
 * @returns NextRequest
 */
function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/cart/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  // Default: anonymous user with a session
  mockGetAuth.mockResolvedValue(null)
  mockGetOrCreate.mockReturnValue({ sessionId: SESSION_ID, isNew: false })
})

// ---------------------------------------------------------------------------
// Branch A: normal option (linked_menu_item_id = null)
// ---------------------------------------------------------------------------

describe('normal option (no linked item)', () => {
  it('inserts exactly one cart_items row', async () => {
    const cartInsertChain = dbChain({ data: { id: CART_ITEM_ID, cart_id: CART_ID, menu_item_id: MENU_ITEM_ID, quantity: 1, selected_options: [OPTION_ID] }, error: null })
    const cartInsertSpy = cartInsertChain.insert as ReturnType<typeof vi.fn>

    mockServiceFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'menu_items':
          return dbChain({ data: { id: MENU_ITEM_ID, eatery_id: EATERY_ID }, error: null })
        case 'menu_item_option_group_assignments':
          return dbChain({ data: [{ option_group_id: OPTION_GROUP_ID }], error: null })
        case 'menu_item_options':
          // Option with no linked item
          return dbChain({ data: [{ id: OPTION_ID, linked_menu_item_id: null }], error: null })
        case 'carts':
          return dbChain({ data: null, error: null })  // no existing cart; insert returns new cart
        case 'cart_items':
          return cartInsertChain
        default:
          return dbChain()
      }
    })

    // Override carts to return a newly created cart on insert
    const cartsChain = dbChain({ data: { id: CART_ID, eatery_id: EATERY_ID }, error: null })
    let cartsCallCount = 0
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'menu_items') return dbChain({ data: { id: MENU_ITEM_ID, eatery_id: EATERY_ID }, error: null })
      if (table === 'menu_item_option_group_assignments') return dbChain({ data: [{ option_group_id: OPTION_GROUP_ID }], error: null })
      if (table === 'menu_item_options') return dbChain({ data: [{ id: OPTION_ID, linked_menu_item_id: null }], error: null })
      if (table === 'carts') {
        cartsCallCount++
        // First call: maybeSingle returns null (no existing cart)
        // Second call (insert): single returns new cart
        if (cartsCallCount === 1) return dbChain({ data: null, error: null })
        return cartsChain
      }
      if (table === 'cart_items') return cartInsertChain
      return dbChain()
    })

    const res = await POST(buildRequest({ menu_item_id: MENU_ITEM_ID, selected_options: [OPTION_ID] }))
    expect(res.status).toBe(201)

    // cart_items.insert called exactly once (the main item, no linked item)
    expect(cartInsertSpy).toHaveBeenCalledTimes(1)
    const [insertedRows] = cartInsertSpy.mock.calls[0] as [Array<{ menu_item_id: string }>]
    expect(insertedRows).toEqual(
      expect.objectContaining({ menu_item_id: MENU_ITEM_ID })
    )
  })
})

// ---------------------------------------------------------------------------
// Regression: menu_items lookup uses the current `eatery_id` column
// (guards against the restaurant_id → eatery_id rename being undone or
// the DB migration drifting away from the code — see bug where the DB
// still had `restaurant_id` and every POST returned 404).
// ---------------------------------------------------------------------------

describe('regression: menu_items lookup column', () => {
  it('selects id, eatery_id and returns 201 on happy path with no options', async () => {
    const menuSelect = vi.fn()
    const menuChain: Record<string, unknown> = {
      eq: vi.fn(function this_eq(this: Record<string, unknown>) { return this }),
      single: vi.fn(() => Promise.resolve({ data: { id: MENU_ITEM_ID, eatery_id: EATERY_ID }, error: null })),
    }
    menuSelect.mockImplementation(() => menuChain)
    menuChain.select = menuSelect

    const cartItemResult = { data: { id: CART_ITEM_ID, cart_id: CART_ID, menu_item_id: MENU_ITEM_ID, quantity: 1, selected_options: [] }, error: null }
    const cartItemsChain: Record<string, unknown> = {
      select: vi.fn(function this_sel(this: Record<string, unknown>) { return this }),
      single: vi.fn(() => Promise.resolve(cartItemResult)),
    }
    cartItemsChain.insert = vi.fn(() => cartItemsChain)

    let cartsCallCount = 0
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'menu_items') return menuChain
      if (table === 'carts') {
        cartsCallCount++
        if (cartsCallCount === 1) return dbChain({ data: null, error: null })
        return dbChain({ data: { id: CART_ID, eatery_id: EATERY_ID }, error: null })
      }
      if (table === 'cart_items') return cartItemsChain
      return dbChain()
    })

    const res = await POST(buildRequest({ menu_item_id: MENU_ITEM_ID, selected_options: [] }))
    expect(res.status).toBe(201)
    expect(menuSelect).toHaveBeenCalledWith('id, eatery_id')
  })
})

// ---------------------------------------------------------------------------
// Branch B: linked option (linked_menu_item_id IS NOT NULL)
// ---------------------------------------------------------------------------

describe('linked option (auto-inserts linked item)', () => {
  it('inserts two cart_items rows — main item and linked item', async () => {
    const insertCalls: unknown[] = []

    /** Build a fresh insert-result chain each time insert() is called */
    function cartItemsInsertResult(isFirst: boolean) {
      const r: Record<string, unknown> = {}
      r.select = vi.fn(() => r)
      r.eq = vi.fn(() => r)
      r.single = vi.fn(() =>
        Promise.resolve(
          isFirst
            ? { data: { id: CART_ITEM_ID, cart_id: CART_ID, menu_item_id: MENU_ITEM_ID, quantity: 1, selected_options: [OPTION_ID] }, error: null }
            : { data: null, error: null }
        )
      )
      // thenability for the linked-item insert (no .single() called on it)
      r.then = (resolve: (v: { data: null; error: null }) => void) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      return r
    }

    let insertCount = 0
    const cartItemsChain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'is']) {
      cartItemsChain[m] = vi.fn(() => cartItemsChain)
    }
    cartItemsChain.insert = vi.fn((rows: unknown) => {
      insertCalls.push(rows)
      insertCount++
      return cartItemsInsertResult(insertCount === 1)
    })
    cartItemsChain.then = (resolve: (v: { data: null; error: null }) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)

    let cartsCallCount = 0
    const newCartChain = dbChain({ data: { id: CART_ID, eatery_id: EATERY_ID }, error: null })

    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'menu_items') return dbChain({ data: { id: MENU_ITEM_ID, eatery_id: EATERY_ID }, error: null })
      if (table === 'menu_item_option_group_assignments') return dbChain({ data: [{ option_group_id: OPTION_GROUP_ID }], error: null })
      if (table === 'menu_item_options') {
        // Option with a linked item
        return dbChain({ data: [{ id: OPTION_ID, linked_menu_item_id: LINKED_ITEM_ID }], error: null })
      }
      if (table === 'carts') {
        cartsCallCount++
        if (cartsCallCount === 1) return dbChain({ data: null, error: null })
        return newCartChain
      }
      if (table === 'cart_items') return cartItemsChain
      return dbChain()
    })

    const res = await POST(buildRequest({ menu_item_id: MENU_ITEM_ID, selected_options: [OPTION_ID] }))
    expect(res.status).toBe(201)

    // insert called twice: once for main item (object) and once for linked items (array)
    expect(insertCalls.length).toBe(2)

    // Second insert arg is the linked items array
    const linkedInsertRows = insertCalls[1] as Array<{ menu_item_id: string; selected_options: string[] }>
    expect(linkedInsertRows).toHaveLength(1)
    expect(linkedInsertRows[0].menu_item_id).toBe(LINKED_ITEM_ID)
    expect(linkedInsertRows[0].selected_options).toEqual([])
  })
})
