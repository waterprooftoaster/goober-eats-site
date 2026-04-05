import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { Conversation, Message } from '@/lib/types/messaging'

// No Supabase client mock needed — guest hook does not use Realtime
const mockFetch = vi.fn()

import { useGuestMessages } from '@/hooks/use-guest-messages'

const ORDER_ID = '00000000-0000-4000-8000-000000000001'

const MOCK_CONVERSATION: Conversation = {
  id: 'conv-111',
  order_id: ORDER_ID,
  orderer_id: null,
  swiper_id: 'user-swiper',
  created_at: '2026-03-29T10:00:00Z',
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversation_id: MOCK_CONVERSATION.id,
    sender_id: null,
    body: 'hello from swiper',
    message_type: 'text',
    expires_at: '2026-03-31T10:00:00Z',
    image_url: null,
    sent_at: '2026-03-29T10:01:00Z',
    read_at: null,
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
  order_status: 'accepted',
}

describe('useGuestMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockResolvedValue(mockJsonOk(INITIAL_DATA))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts with isLoading true', () => {
    const { result } = renderHook(() => useGuestMessages(ORDER_ID, 'open'))
    expect(result.current.isLoading).toBe(true)
  })

  it('sets isLoading false after fetch completes', async () => {
    const { result } = renderHook(() => useGuestMessages(ORDER_ID, 'open'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })

  it('fetches from guest API endpoint', async () => {
    renderHook(() => useGuestMessages(ORDER_ID, 'open'))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(`/api/guest/messages/${ORDER_ID}`)
    })
  })

  it('does NOT call createClient (no Supabase Realtime)', async () => {
    const createClientSpy = vi.fn(() => ({ channel: vi.fn() }))
    vi.doMock('@/lib/supabase/client', () => ({ createClient: createClientSpy }))

    renderHook(() => useGuestMessages(ORDER_ID, 'open'))
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    expect(createClientSpy).not.toHaveBeenCalled()

    vi.doUnmock('@/lib/supabase/client')
  })

  it('sets conversation and messages from successful fetch', async () => {
    const { result } = renderHook(() => useGuestMessages(ORDER_ID, 'open'))
    await waitFor(() => {
      expect(result.current.conversation).toEqual(MOCK_CONVERSATION)
      expect(result.current.messages).toEqual(INITIAL_DATA.messages)
    })
  })

  it('returns orderStatus from API response', async () => {
    const { result } = renderHook(() => useGuestMessages(ORDER_ID, 'open'))
    await waitFor(() => {
      expect(result.current.orderStatus).toBe('accepted')
    })
  })

  it('initializes orderStatus from initialOrderStatus before first fetch', () => {
    const { result } = renderHook(() => useGuestMessages(ORDER_ID, 'in_progress'))
    // Before fetch resolves, should be the initial value
    expect(result.current.orderStatus).toBe('in_progress')
  })

  it('sets error on non-OK response', async () => {
    mockFetch.mockResolvedValue(mockJsonError(401, 'Unauthorized'))
    const { result } = renderHook(() => useGuestMessages(ORDER_ID, 'open'))
    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('polls again after 5 seconds', async () => {
    // Only fake setInterval/clearInterval so React's setTimeout still works
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })

    renderHook(() => useGuestMessages(ORDER_ID, 'open'))
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))

    act(() => { vi.advanceTimersByTime(5000) })

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    expect(mockFetch).toHaveBeenNthCalledWith(2, `/api/guest/messages/${ORDER_ID}`)
  })

  it('does not poll when initialOrderStatus is completed', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })

    renderHook(() => useGuestMessages(ORDER_ID, 'completed'))
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))

    // Advance well past the poll interval — should not trigger extra fetch
    act(() => { vi.advanceTimersByTime(10000) })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does not poll when initialOrderStatus is cancelled', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })

    renderHook(() => useGuestMessages(ORDER_ID, 'cancelled'))
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))

    act(() => { vi.advanceTimersByTime(10000) })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('stops polling once API returns a terminal order_status', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })

    // First fetch: active order
    mockFetch.mockResolvedValueOnce(
      mockJsonOk({ conversation: MOCK_CONVERSATION, messages: [], order_status: 'in_progress' })
    )
    // Second fetch (after 5s): order completed
    mockFetch.mockResolvedValueOnce(
      mockJsonOk({ conversation: MOCK_CONVERSATION, messages: [], order_status: 'completed' })
    )

    const { result } = renderHook(() => useGuestMessages(ORDER_ID, 'open'))
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))

    // First poll
    await act(async () => { vi.advanceTimersByTime(5000) })
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.orderStatus).toBe('completed'))

    // Advance again — should NOT poll because terminal
    act(() => { vi.advanceTimersByTime(5000) })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('conversation transitions from null to non-null after swiper accepts (chatbox appears)', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })

    // Initial fetch: no conversation yet (order is open, waiting for swiper)
    mockFetch.mockResolvedValueOnce(
      mockJsonOk({ conversation: null, messages: [], order_status: 'open' })
    )
    // Poll after 5s: swiper accepted, conversation now exists
    mockFetch.mockResolvedValueOnce(
      mockJsonOk({ conversation: MOCK_CONVERSATION, messages: [makeMessage()], order_status: 'accepted' })
    )

    const { result } = renderHook(() => useGuestMessages(ORDER_ID, 'open'))

    // Confirm initial fetch completed with no conversation
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))

    // Advance past poll interval; await act flushes the async fetch chain
    await act(async () => { vi.advanceTimersByTime(5000) })

    // Conversation transitions null → non-null, which causes the chatbox to render
    await waitFor(() => expect(result.current.conversation).toEqual(MOCK_CONVERSATION))
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.orderStatus).toBe('accepted')
  })

  it('clears interval on unmount', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    const { unmount } = renderHook(() => useGuestMessages(ORDER_ID, 'open'))
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    unmount()
    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  describe('sendMessage', () => {
    it('posts to /api/guest/messages with correct body', async () => {
      const { result } = renderHook(() => useGuestMessages(ORDER_ID, 'open'))
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      mockFetch.mockResolvedValueOnce(mockJsonOk({ id: 'msg-new', body: 'hi', sender_id: null }))

      await act(async () => {
        await result.current.sendMessage('hi')
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/guest/messages',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ order_id: ORDER_ID, body: 'hi', message_type: 'text' }),
        })
      )
    })

    it('throws on non-OK response from sendMessage', async () => {
      const { result } = renderHook(() => useGuestMessages(ORDER_ID, 'open'))
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      mockFetch.mockResolvedValueOnce(mockJsonError(500, 'Failed to send message'))

      await expect(
        act(async () => {
          await result.current.sendMessage('hi')
        })
      ).rejects.toThrow('Failed to send message')
    })
  })
})
