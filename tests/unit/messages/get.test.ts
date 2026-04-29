/**
 * @file get.test.ts
 * @description Unit tests for GET /api/messages/[orderId]. Verifies that
 *   `completion_photo` rows have their stored path replaced with a signed URL
 *   before being returned to the client. Text/system messages pass through.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockFrom, mockSignBatch } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockSignBatch: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

vi.mock('@/lib/storage/sign-screenshots', () => ({
  signCompletionPhotoPathsBatch: mockSignBatch,
}))

import { GET } from '@/app/api/messages/[orderId]/route'

const ORDER_ID = '00000000-0000-4000-8000-000000000abc'
const USER_ID = '00000000-0000-4000-8000-000000000001'
const CONV_ID = '00000000-0000-4000-8000-000000000002'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  mockSignBatch.mockImplementation(async (paths: string[]) => {
    const map = new Map<string, string>()
    for (const p of paths) map.set(p, `https://signed.test/${p}`)
    return map
  })
})

function makeReq() {
  return new NextRequest(`http://localhost/api/messages/${ORDER_ID}`)
}

function makeParams() {
  return { params: Promise.resolve({ orderId: ORDER_ID }) }
}

describe('GET /api/messages/[orderId]', () => {
  it('replaces image_url on completion_photo rows with a signed URL', async () => {
    const conversation = { id: CONV_ID, swiper_id: USER_ID }
    const messages = [
      { id: 'm1', message_type: 'text', body: 'hi', image_url: null },
      { id: 'm2', message_type: 'completion_photo', body: null, image_url: `${ORDER_ID}/uuid.jpg` },
      { id: 'm3', message_type: 'system', body: 'placed', image_url: null },
    ]
    const profile = { full_name: 'Alex' }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: () => ({
            eq: () => ({ single: vi.fn().mockResolvedValue({ data: conversation, error: null }) }),
          }),
        }
      }
      if (table === 'messages') {
        return {
          select: () => ({
            eq: () => ({ order: vi.fn().mockResolvedValue({ data: messages, error: null }) }),
          }),
        }
      }
      // profiles
      return {
        select: () => ({
          eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }) }),
        }),
      }
    })

    const res = await GET(makeReq(), makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()

    const photoMsg = body.messages.find((m: { id: string }) => m.id === 'm2')
    expect(photoMsg.image_url).toBe(`https://signed.test/${ORDER_ID}/uuid.jpg`)

    // text + system rows untouched
    const textMsg = body.messages.find((m: { id: string }) => m.id === 'm1')
    expect(textMsg.image_url).toBeNull()
    const systemMsg = body.messages.find((m: { id: string }) => m.id === 'm3')
    expect(systemMsg.image_url).toBeNull()

    expect(mockSignBatch).toHaveBeenCalledTimes(1)
    expect(mockSignBatch).toHaveBeenCalledWith([`${ORDER_ID}/uuid.jpg`])
  })
})
