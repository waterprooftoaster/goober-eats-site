/**
 * @file use-swiper-queue.test.ts
 * @description Unit tests for useSwiperQueue: registry subscription with the
 *   school-scoped channel name + UUID validation, INSERT/UPDATE event handling
 *   (each triggers a refetch from /api/swiper/pending), and visibility-refetch
 *   reconciliation.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { PendingOrder } from '@/app/swiper/orders/pending-orders-list'
import { __resetRegistryForTests } from '@/lib/realtime/channel-registry'

// ---------------------------------------------------------------------------
// Mocks — hoisted
// ---------------------------------------------------------------------------
const { mockChannel, mockSupabase } = vi.hoisted(() => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  }
  const mockSupabase = {
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn().mockResolvedValue('ok'),
  }
  return { mockChannel, mockSupabase }
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

const mockFetch = vi.fn()

// Import AFTER mocks
import { useSwiperQueue } from '@/hooks/use-swiper-queue'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const SCHOOL_ID = '00000000-0000-4000-8000-0000000000aa'

function makeOrder(id: string, overrides: Partial<PendingOrder> = {}): PendingOrder {
  return {
    id,
    subtotal_cents: 2500,
    restaurant_name: 'Chipotle',
    cart_screenshot_urls: ['https://signed.test/screenshot.jpg'],
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

function mockJsonOk(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockFetch)
  mockSupabase.channel.mockReturnValue(mockChannel)
  __resetRegistryForTests()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useSwiperQueue', () => {
  it('returns initialOrders synchronously on mount', () => {
    const initial = [makeOrder('o1'), makeOrder('o2')]
    const { result } = renderHook(() =>
      useSwiperQueue({ schoolId: SCHOOL_ID, initialOrders: initial })
    )
    expect(result.current.orders).toEqual(initial)
  })

  it('subscribes via the registry to swiperQueueChannel(schoolId)', async () => {
    renderHook(() =>
      useSwiperQueue({ schoolId: SCHOOL_ID, initialOrders: [] })
    )
    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith(`orders:queue:${SCHOOL_ID}`)
    })
  })

  it('configures INSERT, UPDATE, and broadcast listeners on the orders queue channel', async () => {
    renderHook(() =>
      useSwiperQueue({ schoolId: SCHOOL_ID, initialOrders: [] })
    )
    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalledTimes(3)
    })
    const calls = mockChannel.on.mock.calls
    const events = calls.map((c) => (c[1] as { event: string }).event).sort()
    expect(events).toEqual(['INSERT', 'UPDATE', 'queue_changed'])
    // postgres_changes calls carry the school-scoped filter; the broadcast
    // call uses { event: 'queue_changed' } only.
    const pgCalls = calls.filter(([type]) => type === 'postgres_changes')
    expect(pgCalls).toHaveLength(2)
    for (const c of pgCalls) {
      const cfg = c[1] as { schema: string; table: string; filter: string }
      expect(cfg.schema).toBe('public')
      expect(cfg.table).toBe('orders')
      expect(cfg.filter).toBe(`school_id=eq.${SCHOOL_ID}`)
    }
  })

  it('does NOT subscribe when schoolId is not a UUID (fail-closed)', async () => {
    renderHook(() =>
      useSwiperQueue({ schoolId: 'not-a-uuid', initialOrders: [] })
    )
    // Give any async paths a tick.
    await new Promise((r) => setTimeout(r, 10))
    expect(mockSupabase.channel).not.toHaveBeenCalled()
  })

  it('refetches /api/swiper/pending when an INSERT event arrives and surfaces the new order', async () => {
    const newOrder = makeOrder('order-new', { restaurant_name: 'Sweetgreen' })
    mockFetch.mockResolvedValue(mockJsonOk([newOrder]))

    const { result } = renderHook(() =>
      useSwiperQueue({ schoolId: SCHOOL_ID, initialOrders: [] })
    )
    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalledTimes(3)
    })

    const insertHandler = mockChannel.on.mock.calls.find(
      ([, cfg]) => (cfg as { event: string }).event === 'INSERT'
    )?.[2] as (payload: unknown) => void

    act(() => {
      insertHandler({ new: { id: 'order-new', school_id: SCHOOL_ID, status: 'open' } })
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/swiper/pending')
    })
    await waitFor(() => {
      expect(result.current.orders).toEqual([newOrder])
    })
  })

  it('refetches and drops a cancelled row on broadcast queue_changed event (RLS-bypass path)', async () => {
    const initial = [makeOrder('order-cancelled'), makeOrder('order-stays')]
    // After an orderer cancel, /api/swiper/pending no longer returns the
    // cancelled row. The postgres_changes UPDATE event is filtered out by
    // RLS (new row state fails SELECT), so we depend on the broadcast.
    mockFetch.mockResolvedValue(mockJsonOk([initial[1]]))

    const { result } = renderHook(() =>
      useSwiperQueue({ schoolId: SCHOOL_ID, initialOrders: initial })
    )
    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalledTimes(3)
    })

    const broadcastHandler = mockChannel.on.mock.calls.find(
      ([type, cfg]) => type === 'broadcast' && (cfg as { event: string }).event === 'queue_changed'
    )?.[2] as (payload: unknown) => void

    act(() => {
      broadcastHandler({
        event: 'queue_changed',
        type: 'broadcast',
        payload: { order_id: 'order-cancelled', status: 'cancelled' },
      })
    })

    await waitFor(() => {
      expect(result.current.orders.map((o) => o.id)).toEqual(['order-stays'])
    })
  })

  it('refetches and removes a row when an UPDATE drops it out of the predicate', async () => {
    const initial = [makeOrder('order-1'), makeOrder('order-2')]
    // After the UPDATE (e.g., another swiper accepted order-1), the server's
    // pending list returns only the still-open orders.
    mockFetch.mockResolvedValue(mockJsonOk([initial[1]]))

    const { result } = renderHook(() =>
      useSwiperQueue({ schoolId: SCHOOL_ID, initialOrders: initial })
    )
    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalledTimes(3)
    })

    const updateHandler = mockChannel.on.mock.calls.find(
      ([, cfg]) => (cfg as { event: string }).event === 'UPDATE'
    )?.[2] as (payload: unknown) => void

    act(() => {
      updateHandler({
        new: { id: 'order-1', school_id: SCHOOL_ID, status: 'in_progress' },
      })
    })

    await waitFor(() => {
      expect(result.current.orders.map((o) => o.id)).toEqual(['order-2'])
    })
  })

  it('refetches on visibilitychange→visible', async () => {
    const fresh = [makeOrder('order-fresh')]
    mockFetch.mockResolvedValue(mockJsonOk(fresh))

    const { result } = renderHook(() =>
      useSwiperQueue({ schoolId: SCHOOL_ID, initialOrders: [] })
    )
    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalled()
    })

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/swiper/pending')
    })
    await waitFor(() => {
      expect(result.current.orders).toEqual(fresh)
    })
  })

  it('ignores a malformed (non-array) /api/swiper/pending response — guards against deploy schema-skew', async () => {
    const initial = [makeOrder('order-keep')]
    mockFetch.mockResolvedValue(
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ unexpected: 'shape' }),
      })
    )

    const { result } = renderHook(() =>
      useSwiperQueue({ schoolId: SCHOOL_ID, initialOrders: initial })
    )
    await waitFor(() => expect(mockChannel.on).toHaveBeenCalledTimes(3))

    const insertHandler = mockChannel.on.mock.calls.find(
      ([, cfg]) => (cfg as { event: string }).event === 'INSERT'
    )?.[2] as (() => void) | undefined
    if (insertHandler) act(() => insertHandler())

    await new Promise((r) => setTimeout(r, 5))
    // Local state preserved — the bad payload was rejected.
    expect(result.current.orders).toEqual(initial)
  })

  it('removeOrder drops a row from local state without refetching', async () => {
    const initial = [makeOrder('order-1'), makeOrder('order-2')]
    const { result } = renderHook(() =>
      useSwiperQueue({ schoolId: SCHOOL_ID, initialOrders: initial })
    )

    act(() => {
      result.current.removeOrder('order-1')
    })

    expect(result.current.orders.map((o) => o.id)).toEqual(['order-2'])
    // No /api/swiper/pending call from removeOrder itself.
    expect(mockFetch).not.toHaveBeenCalledWith('/api/swiper/pending')
  })

  it('releases the registry handle on unmount (calls supabase.removeChannel)', async () => {
    const { unmount } = renderHook(() =>
      useSwiperQueue({ schoolId: SCHOOL_ID, initialOrders: [] })
    )
    await waitFor(() => expect(mockSupabase.channel).toHaveBeenCalled())
    unmount()
    expect(mockSupabase.removeChannel).toHaveBeenCalled()
  })
})
