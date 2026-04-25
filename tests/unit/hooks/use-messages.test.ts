/**
 * @file use-messages.test.ts
 * @description Unit tests for the useMessages hook (post-S07 registry +
 *   subscribe-before-fetch + temp_id dedupe rewrite).
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { Conversation, Message } from '@/lib/types/messaging'
import { __resetRegistryForTests } from '@/lib/realtime/channel-registry'

// ---------------------------------------------------------------------------
// Mocks — hoisted
// ---------------------------------------------------------------------------
const { mockChannel, mockSupabase, mockFromConversations } = vi.hoisted(() => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  }
  const mockFromConversations = vi.fn()
  const mockSupabase = {
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn().mockResolvedValue('ok'),
    from: vi.fn((table: string) => {
      if (table === 'conversations') return mockFromConversations()
      return {}
    }),
  }
  return { mockChannel, mockSupabase, mockFromConversations }
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

const mockFetch = vi.fn()

// Import AFTER mocks
import { useMessages } from '@/hooks/use-messages'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ORDER_ID = '00000000-0000-4000-8000-000000000001'
const CONV_ID = '11111111-2222-4333-8444-555555555555'

const MOCK_CONVERSATION: Conversation = {
  id: CONV_ID,
  order_id: ORDER_ID,
  orderer_id: 'user-orderer',
  swiper_id: 'user-swiper',
  swiper_full_name: null,
  created_at: '2026-03-23T10:00:00Z',
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversation_id: CONV_ID,
    sender_id: 'user-orderer',
    body: 'hello',
    message_type: 'text',
    expires_at: '2026-03-25T10:00:00Z',
    image_url: null,
    sent_at: '2026-03-23T10:01:00Z',
    temp_id: null,
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

function mockJsonError(status: number, error: string) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
  })
}

const INITIAL_DATA = {
  conversation: MOCK_CONVERSATION,
  messages: [makeMessage()],
}

function setupConversationLookup() {
  // Default: conversation exists; the resolve effect sets resolvedConvId.
  mockFromConversations.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: { id: CONV_ID }, error: null }),
      }),
    }),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useMessages (S07 registry + subscribe-before-fetch + temp_id)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockResolvedValue(mockJsonOk(INITIAL_DATA))
    setupConversationLookup()
    __resetRegistryForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // --- Loading + initial fetch ---

  it('starts with isLoading true', () => {
    const { result } = renderHook(() => useMessages({ orderId: ORDER_ID }))
    expect(result.current.isLoading).toBe(true)
  })

  it('sets isLoading false after successful fetch', async () => {
    const { result } = renderHook(() => useMessages({ orderId: ORDER_ID }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })

  it('sets conversation and messages from successful fetch', async () => {
    const { result } = renderHook(() => useMessages({ orderId: ORDER_ID }))
    await waitFor(() => {
      expect(result.current.conversation).toEqual(MOCK_CONVERSATION)
      expect(result.current.messages).toEqual(INITIAL_DATA.messages)
    })
  })

  it('fetches from correct URL', async () => {
    renderHook(() => useMessages({ orderId: ORDER_ID }))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(`/api/messages/${ORDER_ID}`)
    })
  })

  it('sets error on non-OK response', async () => {
    // 404 is handled specially (no conversation yet — not an error).
    mockFetch.mockResolvedValue(mockJsonError(500, 'Internal server error'))
    const { result } = renderHook(() => useMessages({ orderId: ORDER_ID }))
    await waitFor(() => {
      expect(result.current.error).toBe('Internal server error')
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('sets error on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useMessages({ orderId: ORDER_ID }))
    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
      expect(result.current.isLoading).toBe(false)
    })
  })

  // --- Registry consumption ---

  it('subscribes via the channel registry (calls supabase.channel with messages:{convId})', async () => {
    renderHook(() => useMessages({ orderId: ORDER_ID }))
    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith(`messages:${CONV_ID}`)
    })
  })

  it('uses pre-resolved conversationId WITHOUT calling supabase.from("conversations")', async () => {
    renderHook(() => useMessages({ orderId: ORDER_ID, conversationId: CONV_ID }))
    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith(`messages:${CONV_ID}`)
    })
    // The B2 pairing benefit: provider already JOINed conversations, so the
    // hook MUST NOT issue its own conversations lookup.
    expect(mockSupabase.from).not.toHaveBeenCalledWith('conversations')
  })

  it('subscribes with correct postgres_changes filter', async () => {
    renderHook(() => useMessages({ orderId: ORDER_ID }))
    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${CONV_ID}`,
        }),
        expect.any(Function)
      )
    })
  })

  it('releases the registry handle on unmount (calls supabase.removeChannel)', async () => {
    const { unmount } = renderHook(() => useMessages({ orderId: ORDER_ID }))
    await waitFor(() => expect(mockSupabase.channel).toHaveBeenCalled())
    unmount()
    expect(mockSupabase.removeChannel).toHaveBeenCalled()
  })

  // --- Realtime + dedupe ---

  it('appends a new message on realtime INSERT', async () => {
    const { result } = renderHook(() => useMessages({ orderId: ORDER_ID }))
    await waitFor(() => expect(result.current.conversation).not.toBeNull())

    const newMsg = makeMessage({ id: 'msg-2', body: 'world' })
    const realtimeCallback = mockChannel.on.mock.calls[0][2] as (p: { new: Message }) => void

    act(() => {
      realtimeCallback({ new: newMsg })
    })

    expect(result.current.messages).toContainEqual(newMsg)
  })

  it('dedupes by id when realtime delivers an existing id', async () => {
    const { result } = renderHook(() => useMessages({ orderId: ORDER_ID }))
    await waitFor(() => expect(result.current.conversation).not.toBeNull())

    const existingMsg = INITIAL_DATA.messages[0]
    const realtimeCallback = mockChannel.on.mock.calls[0][2] as (p: { new: Message }) => void

    act(() => {
      realtimeCallback({ new: existingMsg })
    })

    expect(result.current.messages.filter((m) => m.id === existingMsg.id)).toHaveLength(1)
  })

  it('replaces an optimistic entry when realtime arrives with matching temp_id', async () => {
    const { result } = renderHook(() => useMessages({ orderId: ORDER_ID }))
    await waitFor(() => expect(result.current.conversation).not.toBeNull())

    const TEMP = '99999999-0000-4000-8000-000000000001'
    act(() => {
      result.current.appendOptimistic(TEMP, 'optimistic body', 'user-orderer')
    })
    expect(result.current.messages.some((m) => m.temp_id === TEMP && m.status === 'pending')).toBe(true)

    const canonical = makeMessage({ id: 'msg-canonical', body: 'optimistic body', temp_id: TEMP })
    const realtimeCallback = mockChannel.on.mock.calls[0][2] as (p: { new: Message }) => void

    act(() => {
      realtimeCallback({ new: canonical })
    })

    // Only ONE entry for that temp_id, and it's the canonical row (no status flag)
    const entries = result.current.messages.filter((m) => m.temp_id === TEMP)
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe('msg-canonical')
    expect(entries[0].status).toBeUndefined()
  })

  // --- Subscribe-before-fetch buffering ---

  it('buffers realtime INSERTs that arrive before the initial fetch completes, then flushes them via dedupe', async () => {
    let resolveFetch!: (value: unknown) => void
    const slowFetch = new Promise((resolve) => {
      resolveFetch = resolve
    })
    mockFetch.mockReturnValue(slowFetch)

    const { result } = renderHook(() => useMessages({ orderId: ORDER_ID }))

    // Wait for the subscription to be set up (after conversation_id resolves)
    await waitFor(() => expect(mockChannel.on).toHaveBeenCalled())

    // Simulate a realtime INSERT BEFORE the slow fetch resolves
    const earlyMsg = makeMessage({ id: 'msg-early', body: 'arrived during fetch' })
    const realtimeCallback = mockChannel.on.mock.calls[0][2] as (p: { new: Message }) => void
    act(() => {
      realtimeCallback({ new: earlyMsg })
    })

    // The fetch hasn't resolved — message should NOT be in state yet
    expect(result.current.messages).toEqual([])

    // Now resolve the fetch with INITIAL_DATA (which does NOT include earlyMsg)
    await act(async () => {
      resolveFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve(INITIAL_DATA),
      })
      await slowFetch
    })

    // After flush, earlyMsg AND INITIAL_DATA's messages are both present
    await waitFor(() => {
      const ids = result.current.messages.map((m) => m.id)
      expect(ids).toContain('msg-early')
      expect(ids).toContain(INITIAL_DATA.messages[0].id)
    })
  })

  // --- Optimistic UI ---

  it('appendOptimistic adds a pending entry with the supplied temp_id', () => {
    const { result } = renderHook(() => useMessages({ orderId: ORDER_ID }))
    const TEMP = '99999999-0000-4000-8000-000000000002'

    act(() => {
      result.current.appendOptimistic(TEMP, 'pending text', 'user-orderer')
    })

    const opt = result.current.messages.find((m) => m.temp_id === TEMP)
    expect(opt).toBeDefined()
    expect(opt?.body).toBe('pending text')
    expect(opt?.status).toBe('pending')
    expect(opt?.sender_id).toBe('user-orderer')
  })

  it('markFailed flips a pending entry to failed', () => {
    const { result } = renderHook(() => useMessages({ orderId: ORDER_ID }))
    const TEMP = '99999999-0000-4000-8000-000000000003'

    act(() => {
      result.current.appendOptimistic(TEMP, 'will fail', 'user-orderer')
    })
    act(() => {
      result.current.markFailed(TEMP)
    })

    const failed = result.current.messages.find((m) => m.temp_id === TEMP)
    expect(failed?.status).toBe('failed')
  })

  // --- sendMessage ---

  describe('sendMessage', () => {
    it('calls POST /api/messages with order_id, body, message_type=text, and temp_id', async () => {
      const { result } = renderHook(() => useMessages({ orderId: ORDER_ID }))
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      const TEMP = '99999999-0000-4000-8000-000000000004'
      mockFetch.mockResolvedValueOnce(
        mockJsonOk(makeMessage({ id: 'msg-new', body: 'hi', temp_id: TEMP }))
      )

      await act(async () => {
        await result.current.sendMessage('hi', TEMP)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/messages',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ order_id: ORDER_ID, body: 'hi', message_type: 'text', temp_id: TEMP }),
        })
      )
    })

    it('throws on non-OK response', async () => {
      const { result } = renderHook(() => useMessages({ orderId: ORDER_ID }))
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      mockFetch.mockResolvedValueOnce(mockJsonError(500, 'Failed to send message'))

      await expect(
        act(async () => {
          await result.current.sendMessage('hi')
        })
      ).rejects.toThrow('Failed to send message')
    })
  })

  // --- Effect-lifecycle race regression (S07 code-review MEDIUM #1) ---
  //
  // S07 cumulative code-review flagged: "StrictMode race in use-messages
  // Effect 2/3 ordering (initialFetchDoneRef reset placement)". The fix
  // moves the reset from Effect 2 (subscription-setup) to Effect 3 cleanup
  // (fetch-lifecycle), tying the flag's lifetime to the fetch it gates.
  //
  // The bug manifests when Effect 3 re-runs WITHOUT Effect 2 re-running
  // (e.g. orderId changes while resolvedConvId stays — possible via the
  // providedConvId path that the chat-panel-provider's B2 JOIN takes).
  // With the reset on Effect 2, the stale done=true survives, so a realtime
  // INSERT arriving during the new fetch is merged DIRECTLY into state and
  // then OVERWRITTEN by the new fetch's response. With the fix, Effect 3
  // cleanup resets done=false; the new INSERT is buffered and survives.

  it('preserves a realtime INSERT delivered during a stable-conversationId orderId change', async () => {
    const ORDER_A = ORDER_ID
    const ORDER_B = '00000000-0000-4000-8000-00000000000B'
    const FETCH_A_DATA = INITIAL_DATA
    const FETCH_B_DATA = {
      conversation: MOCK_CONVERSATION,
      messages: [makeMessage({ id: 'msg-b1', body: 'order B initial' })],
    }

    // First fetch (orderId=A) resolves immediately.
    mockFetch.mockResolvedValueOnce(mockJsonOk(FETCH_A_DATA))

    const { result, rerender } = renderHook(
      ({ orderId }) => useMessages({ orderId, conversationId: CONV_ID }),
      { initialProps: { orderId: ORDER_A } }
    )

    await waitFor(() => {
      expect(result.current.messages).toEqual(FETCH_A_DATA.messages)
    })

    // Now make the second fetch (orderId=B) slow so we can interleave a
    // realtime INSERT during the new fetch.
    let resolveFetchB!: (value: unknown) => void
    const slowFetchB = new Promise((resolve) => {
      resolveFetchB = resolve
    })
    mockFetch.mockReturnValueOnce(slowFetchB)

    rerender({ orderId: ORDER_B })

    // Trigger the Effect 3 re-run with the new orderId while resolvedConvId
    // (and thus Effect 2) stays stable — no new subscription is set up.
    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith(`/api/messages/${ORDER_B}`)
    })

    // A realtime INSERT arrives during the new fetch's flight.
    const lateMsg = makeMessage({ id: 'msg-late', body: 'arrived during orderB fetch' })
    const realtimeCallback = mockChannel.on.mock.calls[0][2] as (p: { new: Message }) => void
    act(() => {
      realtimeCallback({ new: lateMsg })
    })

    // Resolve the new fetch with B's initial data (which does NOT include lateMsg).
    await act(async () => {
      resolveFetchB({
        ok: true,
        status: 200,
        json: () => Promise.resolve(FETCH_B_DATA),
      })
      await slowFetchB
    })

    // The lateMsg MUST survive the orderId change. With the bug, it would be
    // overwritten because done=true caused it to be merged directly into the
    // pre-fetch state, then replaced by the post-fetch state.
    await waitFor(() => {
      const ids = result.current.messages.map((m) => m.id)
      expect(ids).toContain('msg-late')
      expect(ids).toContain('msg-b1')
    })
  })

  // --- Visibility refetch ---

  it('refetches messages on visibilitychange→visible and dedupes into existing state', async () => {
    const { result } = renderHook(() => useMessages({ orderId: ORDER_ID }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Reset fetch and queue a refetch payload with one extra message
    const newMsg = makeMessage({ id: 'msg-late', body: 'arrived while away' })
    mockFetch.mockResolvedValueOnce(
      mockJsonOk({ conversation: MOCK_CONVERSATION, messages: [INITIAL_DATA.messages[0], newMsg] })
    )

    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => {
      const ids = result.current.messages.map((m) => m.id)
      expect(ids).toContain('msg-late')
      expect(ids).toContain(INITIAL_DATA.messages[0].id)
    })
  })
})
