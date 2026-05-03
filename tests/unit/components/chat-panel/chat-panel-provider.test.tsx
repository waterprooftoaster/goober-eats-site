/**
 * @file chat-panel-provider.test.tsx
 * @description Specs for the S07 ChatPanelProvider rewrite — verifies registry
 *   consumption (instead of direct supabase.channel), the conversations(id)
 *   LEFT JOIN in loadActiveOrders (B2 pairing), and the openPanel
 *   conversationId pass-through.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useEffect } from 'react'
import { render, waitFor, cleanup } from '@testing-library/react'
import { useChatPanel } from '@/components/chat-panel/chat-panel-context'
import { __resetRegistryForTests } from '@/lib/realtime/channel-registry'

// ---------------------------------------------------------------------------
// Mocks — hoisted
// ---------------------------------------------------------------------------
const { mockChannel, mockSupabase, mockOrdersQuery, mockGetUser } = vi.hoisted(() => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  }
  const mockOrdersQuery = vi.fn()
  const mockGetUser = vi.fn()
  const mockSupabase = {
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn(),
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'orders') return mockOrdersQuery()
      return {}
    }),
  }
  return { mockChannel, mockSupabase, mockOrdersQuery, mockGetUser }
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

import { ChatPanelProvider } from '@/components/chat-panel/chat-panel-provider'

afterEach(cleanup)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const USER_ID = '11111111-2222-4333-8444-555555555551'
const ORDER_ID = '11111111-2222-4333-8444-555555555552'
const CONV_ID = '11111111-2222-4333-8444-555555555553'

function setupOrdersJoinReturn(rows: unknown[]) {
  // The query chain ends with one of:
  //   .eq('anon_user_id', uid)             — anon users
  //   .or('orderer_id.eq.X,swiper_id.eq.X') — authenticated users (orderer OR swiper)
  const result = Promise.resolve({ data: rows, error: null })
  const orderChain = {
    eq: vi.fn(() => result),
    or: vi.fn(() => result),
  }
  const inChain = { order: vi.fn(() => orderChain) }
  const selectChain = { in: vi.fn(() => inChain) }
  mockOrdersQuery.mockReturnValue({ select: vi.fn(() => selectChain) })
  return { selectChain, orderChain }
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetRegistryForTests()
  // vi.clearAllMocks resets mock return values; re-bind the channel singleton
  mockSupabase.channel.mockReturnValue(mockChannel)
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID, is_anonymous: false } } })
  setupOrdersJoinReturn([])
})

/**
 * Probe component that captures the chat panel state into a callback (avoids
 * reassigning module-level let bindings — which the react-hooks/globals
 * lint rule flags). Pass a callback that stashes into a holder object.
 */
function StateProbe({ onState }: { onState: (state: ReturnType<typeof useChatPanel>) => void }) {
  const state = useChatPanel()
  useEffect(() => {
    onState(state)
  }, [state, onState])
  return null
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ChatPanelProvider (S07 — registry + conversations JOIN + visibility)', () => {
  it('subscribes to the orders channel via the registry (calls supabase.channel for orders:orderer:{userId})', async () => {
    render(<ChatPanelProvider userId={USER_ID}><div /></ChatPanelProvider>)

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith(`orders:orderer:${USER_ID}`)
    })
  })

  it('loadActiveOrders selects conversations(id) for the B2 pairing', async () => {
    const { selectChain } = setupOrdersJoinReturn([])
    render(<ChatPanelProvider userId={USER_ID}><div /></ChatPanelProvider>)

    await waitFor(() => {
      expect(mockOrdersQuery).toHaveBeenCalled()
    })

    // The select string must include conversations(id) — that's what makes the
    // pre-resolved conversationId available to useMessages.
    const selectArg = (mockOrdersQuery.mock.results[0].value as { select: ReturnType<typeof vi.fn> }).select.mock.calls[0][0]
    expect(selectArg).toContain('conversations(id)')
    // sanity: also includes restaurant_name (post-grubhub-pivot field)
    expect(selectArg).toContain('restaurant_name')
    // and the in('status', ...) chain was wired with exactly the active statuses
    expect(selectChain.in).toHaveBeenCalledWith('status', ['open', 'in_progress'])
  })

  // Regression guard: completed orders must NOT auto-re-open after refresh.
  // Symptom previously: orderer dismisses a completed-order panel, refresh
  // brings it right back because loadActiveOrders included 'completed'.
  // Real-time updates (in_progress → completed while the panel is already
  // open) still flow through updateOrderStatus and let the orderer see the
  // completion view; this only excludes the auto-open path.
  it('loadActiveOrders does NOT include completed in the status filter', async () => {
    const { selectChain } = setupOrdersJoinReturn([])
    render(<ChatPanelProvider userId={USER_ID}><div /></ChatPanelProvider>)

    await waitFor(() => {
      expect(selectChain.in).toHaveBeenCalledWith('status', expect.any(Array))
    })

    const passedStatuses = (selectChain.in.mock.calls[0] as unknown as [string, string[]])[1]
    expect(passedStatuses).not.toContain('completed')
    expect(passedStatuses).toEqual(['open', 'in_progress'])
  })

  it('openPanel receives the JOINed conversationId for each active order', async () => {
    setupOrdersJoinReturn([
      {
        id: ORDER_ID,
        status: 'in_progress',
        restaurant_name: 'Chipotle',
        conversations: [{ id: CONV_ID }],
      },
    ])

    const captured: { value: ReturnType<typeof useChatPanel> | null } = { value: null }
    render(
      <ChatPanelProvider userId={USER_ID}>
        <StateProbe onState={(s) => { captured.value = s }} />
      </ChatPanelProvider>
    )

    await waitFor(() => {
      expect(captured.value?.orders[ORDER_ID]).toBeDefined()
    })
    expect(captured.value?.orders[ORDER_ID]?.conversationId).toBe(CONV_ID)
    expect(captured.value?.orders[ORDER_ID]?.eateryName).toBe('Chipotle')
  })

  it('handles a single-object (not array) shape for the joined conversations field', async () => {
    setupOrdersJoinReturn([
      {
        id: ORDER_ID,
        status: 'open',
        restaurant_name: "Joe's Pizza",
        // Some Supabase responses return the object form when there's a 1:1 FK
        conversations: { id: CONV_ID },
      },
    ])

    const captured: { value: ReturnType<typeof useChatPanel> | null } = { value: null }
    render(
      <ChatPanelProvider userId={USER_ID}>
        <StateProbe onState={(s) => { captured.value = s }} />
      </ChatPanelProvider>
    )

    await waitFor(() => {
      expect(captured.value?.orders[ORDER_ID]?.conversationId).toBe(CONV_ID)
    })
  })

  it('handles a null conversations field (status=open before swiper accepts)', async () => {
    setupOrdersJoinReturn([
      {
        id: ORDER_ID,
        status: 'open',
        restaurant_name: 'Sweetgreen',
        conversations: null,
      },
    ])

    const captured: { value: ReturnType<typeof useChatPanel> | null } = { value: null }
    render(
      <ChatPanelProvider userId={USER_ID}>
        <StateProbe onState={(s) => { captured.value = s }} />
      </ChatPanelProvider>
    )

    await waitFor(() => {
      expect(captured.value?.orders[ORDER_ID]).toBeDefined()
    })
    expect(captured.value?.orders[ORDER_ID]?.conversationId).toBeNull()
  })

  it('does NOT subscribe when userId is null', async () => {
    render(<ChatPanelProvider userId={null}><div /></ChatPanelProvider>)

    // Wait a tick to ensure no async subscribe fires
    await new Promise((r) => setTimeout(r, 10))

    expect(mockSupabase.channel).not.toHaveBeenCalled()
    expect(mockOrdersQuery).not.toHaveBeenCalled()
  })

  // --- Dismissed-panel re-open regression (S07 code-review MEDIUM #2) ---
  //
  // The S07 cumulative code-reviewer flagged: "loadActiveOrders re-opens
  // panels that the user dismissed via closePanel on visibility refetch."
  //
  // Scenario: user closes a panel → orderId removed from state. Tab is
  // backgrounded; useVisibilityRefetch triggers loadActiveOrders on return.
  // Without the fix, openPanel sees orderId is no longer in state and
  // re-creates the panel. With the fix, a dismissedOrderIdsRef set tracks
  // user-dismissed orders and excludes them from re-opening.
  it('does not re-open a user-dismissed panel on visibility-refetch loadActiveOrders', async () => {
    setupOrdersJoinReturn([
      {
        id: ORDER_ID,
        status: 'in_progress',
        restaurant_name: 'Chipotle',
        conversations: [{ id: CONV_ID }],
      },
    ])

    const captured: { value: ReturnType<typeof useChatPanel> | null } = { value: null }
    render(
      <ChatPanelProvider userId={USER_ID}>
        <StateProbe onState={(s) => { captured.value = s }} />
      </ChatPanelProvider>
    )

    // Initial auto-open
    await waitFor(() => {
      expect(captured.value?.orders[ORDER_ID]).toBeDefined()
    })

    // User dismisses the panel
    captured.value!.closePanel(ORDER_ID)
    await waitFor(() => {
      expect(captured.value?.orders[ORDER_ID]).toBeUndefined()
    })

    // Re-arm the orders query — loadActiveOrders will see the same row again
    setupOrdersJoinReturn([
      {
        id: ORDER_ID,
        status: 'in_progress',
        restaurant_name: 'Chipotle',
        conversations: [{ id: CONV_ID }],
      },
    ])

    // Simulate a visibility refetch — visibilitychange→visible triggers
    // loadActiveOrders via useVisibilityRefetch.
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    // Give the async refetch chain a chance to settle.
    await new Promise((r) => setTimeout(r, 50))

    // The dismissed order MUST NOT reappear in state.
    expect(captured.value?.orders[ORDER_ID]).toBeUndefined()
  })

  // --- Phase 2: swiper-side realtime + loadActiveOrders ---
  //
  // Symptom previously: chat-panel-provider only subscribed via
  // ordersOrdererChannel filtered on orderer_id (or anon_user_id). Swipers
  // never received orders UPDATE payloads, so badges on /current-orders
  // didn't transition live (e.g., when an orderer cancels). loadActiveOrders
  // also queried only by orderer_id for auth users, so swiper-accepted
  // orders never surfaced in the bottom-dock.

  it('subscribes to BOTH orderer and swiper channels for an authenticated user', async () => {
    render(<ChatPanelProvider userId={USER_ID}><div /></ChatPanelProvider>)

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith(`orders:orderer:${USER_ID}`)
    })
    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith(`orders:swiper:${USER_ID}`)
    })
  })

  it('does NOT subscribe to the swiper channel for an anonymous user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID, is_anonymous: true } } })
    render(<ChatPanelProvider userId={USER_ID}><div /></ChatPanelProvider>)

    // Wait long enough for both async subscribe paths to settle.
    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith(`orders:orderer:${USER_ID}`)
    })
    await new Promise((r) => setTimeout(r, 20))

    const swiperCalls = mockSupabase.channel.mock.calls.filter(
      ([name]) => name === `orders:swiper:${USER_ID}`
    )
    expect(swiperCalls).toHaveLength(0)
  })

  it('updates panelOrders status when an UPDATE arrives on the swiper channel', async () => {
    // Seed an order assigned to USER_ID as the swiper.
    setupOrdersJoinReturn([
      {
        id: ORDER_ID,
        status: 'in_progress',
        restaurant_name: 'Chipotle',
        conversations: [{ id: CONV_ID }],
      },
    ])

    const captured: { value: ReturnType<typeof useChatPanel> | null } = { value: null }
    const { act } = await import('@testing-library/react')
    render(
      <ChatPanelProvider userId={USER_ID}>
        <StateProbe onState={(s) => { captured.value = s }} />
      </ChatPanelProvider>
    )

    // Wait for both subscriptions AND the auto-open.
    await waitFor(() => {
      expect(captured.value?.orders[ORDER_ID]).toBeDefined()
    })
    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith(`orders:swiper:${USER_ID}`)
    })

    // The realtime callback handler is the third argument of every .on() call.
    // Subscriptions register in order: orderer first, swiper second. Find the
    // swiper-channel handler by inspecting each .on() call's filter.
    const swiperHandler = mockChannel.on.mock.calls.find(
      ([, cfg]) => (cfg as { filter?: string }).filter === `swiper_id=eq.${USER_ID}`
    )?.[2] as ((p: { new: { id: string; status: string } }) => void) | undefined

    expect(swiperHandler).toBeDefined()

    // Orderer cancels — but 'cancelled' is terminal and removes the panel; use
    // 'completed' which keeps the entry with its updated status so we can
    // assert the swiper-channel delivery actually drove updateOrderStatus.
    act(() => {
      swiperHandler!({ new: { id: ORDER_ID, status: 'completed' } })
    })

    await waitFor(() => {
      expect(captured.value?.orders[ORDER_ID]?.status).toBe('completed')
    })
  })

  it('loadActiveOrders queries with .or(orderer_id, swiper_id) for authenticated users', async () => {
    const { orderChain } = setupOrdersJoinReturn([])
    render(<ChatPanelProvider userId={USER_ID}><div /></ChatPanelProvider>)

    await waitFor(() => {
      expect(orderChain.or).toHaveBeenCalledWith(
        `orderer_id.eq.${USER_ID},swiper_id.eq.${USER_ID}`
      )
    })
    // Auth path must NOT use the anon eq('anon_user_id', ...) filter.
    expect(orderChain.eq).not.toHaveBeenCalled()
  })

  it('loadActiveOrders surfaces a swiper-assigned order in panel state', async () => {
    setupOrdersJoinReturn([
      {
        id: ORDER_ID,
        status: 'in_progress',
        restaurant_name: 'Sweetgreen',
        // Server returned this row because the .or() matched swiper_id.eq.X.
        // The shape is identical to an orderer-matched row.
        conversations: [{ id: CONV_ID }],
      },
    ])

    const captured: { value: ReturnType<typeof useChatPanel> | null } = { value: null }
    render(
      <ChatPanelProvider userId={USER_ID}>
        <StateProbe onState={(s) => { captured.value = s }} />
      </ChatPanelProvider>
    )

    await waitFor(() => {
      expect(captured.value?.orders[ORDER_ID]?.eateryName).toBe('Sweetgreen')
    })
    expect(captured.value?.orders[ORDER_ID]?.conversationId).toBe(CONV_ID)
  })

  it('still uses .eq(anon_user_id) for anonymous users (no .or)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID, is_anonymous: true } } })
    const { orderChain } = setupOrdersJoinReturn([])
    render(<ChatPanelProvider userId={USER_ID}><div /></ChatPanelProvider>)

    await waitFor(() => {
      expect(orderChain.eq).toHaveBeenCalledWith('anon_user_id', USER_ID)
    })
    expect(orderChain.or).not.toHaveBeenCalled()
  })
})
