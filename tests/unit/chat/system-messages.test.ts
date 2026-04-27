/**
 * @file system-messages.test.ts
 * @description Unit tests for system message generation from order status transitions.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockFrom })),
}))

import { sendSystemMessage } from '@/lib/chat/system-messages'

const VALID_ORDER_ID = '00000000-0000-4000-8000-000000000001'
const MOCK_CONVERSATION = { id: 'conv-456' }

describe('sendSystemMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves silently when conversation not found', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
    }))

    await expect(sendSystemMessage(VALID_ORDER_ID, 'hello')).resolves.toBeUndefined()
  })

  it('inserts a system message with correct fields', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ data: {}, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: () => ({
            eq: () => ({ single: vi.fn().mockResolvedValue({ data: MOCK_CONVERSATION, error: null }) }),
          }),
        }
      }
      return { insert: mockInsert }
    })

    await sendSystemMessage(VALID_ORDER_ID, 'Swiper accepted your order')

    expect(mockInsert).toHaveBeenCalledWith({
      conversation_id: MOCK_CONVERSATION.id,
      sender_id: null,
      body: 'Swiper accepted your order',
      message_type: 'system',
    })
  })
})
