/**
 * @file use-messages.test.ts
 * @description Unit tests for the useMessages hook (Realtime message subscription).
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { Conversation, Message } from '@/lib/types/messaging'

const { mockChannel, mockSupabase } = vi.hoisted(() => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  }
  return {
    mockChannel,
    mockSupabase: {
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn().mockResolvedValue('ok'),
    },
  }
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

const mockFetch = vi.fn()

import { useMessages } from '@/hooks/use-messages'

const ORDER_ID = '00000000-0000-4000-8000-000000000001'

const MOCK_CONVERSATION: Conversation = {
  id: 'conv-111',
  order_id: ORDER_ID,
  orderer_id: 'user-orderer',
  swiper_id: 'user-swiper',
  swiper_full_name: null,
  created_at: '2026-03-23T10:00:00Z',
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversation_id: MOCK_CONVERSATION.id,
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

describe('useMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockResolvedValue(mockJsonOk(INITIAL_DATA))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts with isLoading true', () => {
    const { result } = renderHook(() => useMessages(ORDER_ID))
    expect(result.current.isLoading).toBe(true)
  })

  it('sets isLoading false after successful fetch', async () => {
    const { result } = renderHook(() => useMessages(ORDER_ID))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })

  it('sets conversation and messages from successful fetch', async () => {
    const { result } = renderHook(() => useMessages(ORDER_ID))
    await waitFor(() => {
      expect(result.current.conversation).toEqual(MOCK_CONVERSATION)
      expect(result.current.messages).toEqual(INITIAL_DATA.messages)
    })
  })

  it('fetches from correct URL', async () => {
    renderHook(() => useMessages(ORDER_ID))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(`/api/messages/${ORDER_ID}`)
    })
  })

  it('sets error on non-OK response', async () => {
    // 404 is handled specially (no conversation yet — not an error).
    // Use 500 to test the actual error path.
    mockFetch.mockResolvedValue(mockJsonError(500, 'Internal server error'))
    const { result } = renderHook(() => useMessages(ORDER_ID))
    await waitFor(() => {
      expect(result.current.error).toBe('Internal server error')
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('sets error on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useMessages(ORDER_ID))
    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('creates realtime channel after conversation loads', async () => {
    renderHook(() => useMessages(ORDER_ID))
    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith(`messages:${MOCK_CONVERSATION.id}`)
    })
  })

  it('subscribes with correct filter', async () => {
    renderHook(() => useMessages(ORDER_ID))
    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${MOCK_CONVERSATION.id}`,
        }),
        expect.any(Function)
      )
    })
  })

  it('appends new message on realtime INSERT', async () => {
    const { result } = renderHook(() => useMessages(ORDER_ID))

    await waitFor(() => expect(result.current.conversation).not.toBeNull())

    const newMsg = makeMessage({ id: 'msg-2', body: 'world' })
    const realtimeCallback = mockChannel.on.mock.calls[0][2] as (p: { new: Message }) => void

    act(() => {
      realtimeCallback({ new: newMsg })
    })

    expect(result.current.messages).toContainEqual(newMsg)
  })

  it('deduplicates messages when realtime delivers an existing id', async () => {
    const { result } = renderHook(() => useMessages(ORDER_ID))

    await waitFor(() => expect(result.current.conversation).not.toBeNull())

    const existingMsg = INITIAL_DATA.messages[0]
    const realtimeCallback = mockChannel.on.mock.calls[0][2] as (p: { new: Message }) => void

    act(() => {
      realtimeCallback({ new: existingMsg })
    })

    expect(result.current.messages.filter((m) => m.id === existingMsg.id)).toHaveLength(1)
  })

  it('calls removeChannel on unmount', async () => {
    const { unmount } = renderHook(() => useMessages(ORDER_ID))

    await waitFor(() => expect(mockSupabase.channel).toHaveBeenCalled())

    unmount()

    expect(mockSupabase.removeChannel).toHaveBeenCalled()
  })

  describe('sendMessage', () => {
    it('calls POST /api/messages with correct body', async () => {
      const { result } = renderHook(() => useMessages(ORDER_ID))
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      mockFetch.mockResolvedValueOnce(mockJsonOk({ id: 'msg-new', body: 'hi' }))

      await act(async () => {
        await result.current.sendMessage('hi')
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/messages',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ order_id: ORDER_ID, body: 'hi', message_type: 'text' }),
        })
      )
    })

    it('throws on non-OK response', async () => {
      const { result } = renderHook(() => useMessages(ORDER_ID))
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
