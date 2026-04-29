/**
 * @file status.test.ts
 * @description Unit tests for PATCH /api/orders/[id]/status — focuses on the
 *   un-accept (in_progress → open) branch: personalised system message body
 *   includes the swiper's full_name, conversations.swiper_id is cleared via
 *   the service client, and orders.swiper_id is null'd atomically.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockServerFrom, mockServiceFrom, mockSendSystemMessage, mockTransferToSwiper, mockSignCartScreenshotPaths } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockServerFrom: vi.fn(),
    mockServiceFrom: vi.fn(),
    mockSendSystemMessage: vi.fn().mockResolvedValue(undefined),
    mockTransferToSwiper: vi.fn().mockResolvedValue(undefined),
    mockSignCartScreenshotPaths: vi.fn(),
  }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockServerFrom,
  })),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom })),
}))

vi.mock('@/lib/chat/system-messages', () => ({
  sendSystemMessage: mockSendSystemMessage,
}))

vi.mock('@/lib/stripe/transfer', () => ({
  transferToSwiper: mockTransferToSwiper,
}))

vi.mock('@/lib/storage/sign-screenshots', () => ({
  signCartScreenshotPaths: mockSignCartScreenshotPaths,
}))

import { PATCH } from '@/app/api/orders/[id]/status/route'

function dbResult(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const mock: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'is']) {
    mock[m] = vi.fn(() => mock)
  }
  mock.single = vi.fn(() => Promise.resolve(result))
  mock.maybeSingle = vi.fn(() => Promise.resolve(result))
  mock.then = (resolve: (v: typeof result) => void) =>
    Promise.resolve(result).then(resolve)
  return mock
}

const SWIPER_ID = '00000000-0000-4000-8000-000000000001'
const ORDERER_ID = '00000000-0000-4000-8000-000000000002'
const ORDER_ID = '00000000-0000-4000-8000-000000000100'

async function callPatch(status: string): Promise<Response> {
  const req = new NextRequest(`http://localhost/api/orders/${ORDER_ID}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return PATCH(req, { params: Promise.resolve({ id: ORDER_ID }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: SWIPER_ID } }, error: null })
  mockSignCartScreenshotPaths.mockImplementation(async (paths: string[]) =>
    paths.map((p) => `https://signed.test/${p}`)
  )
})

describe('PATCH /api/orders/[id]/status — un-accept (in_progress → open)', () => {
  it('sends a personalised system message with the swiper full_name and clears conversations.swiper_id', async () => {
    // Server client chain (in order):
    //   1. orders.select (current row)
    //   2. profiles.select (swiper full_name lookup)
    mockServerFrom
      .mockReturnValueOnce(
        dbResult({
          data: {
            id: ORDER_ID,
            orderer_id: ORDERER_ID,
            swiper_id: SWIPER_ID,
            status: 'in_progress',
          },
        })
      )
      .mockReturnValueOnce(dbResult({ data: { full_name: 'Alex Smith' } }))

    // Service client chain (in order):
    //   1. orders.update (status=open, swiper_id=null) — atomic
    //   2. conversations.update (swiper_id=null)
    const updatedOrder = {
      id: ORDER_ID,
      orderer_id: ORDERER_ID,
      swiper_id: null,
      school_id: '00000000-0000-4000-8000-000000000aaa',
      restaurant_name: 'Chipotle',
      cart_screenshot_urls: [],
      status: 'open',
      subtotal_cents: 2500,
      total_cents: 1500,
      guest_name: null,
      guest_email: null,
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    }
    const orderUpdateChain = dbResult({ data: updatedOrder })
    const convUpdateChain = dbResult({ data: null, error: null })
    mockServiceFrom.mockReturnValueOnce(orderUpdateChain).mockReturnValueOnce(convUpdateChain)

    const res = await callPatch('open')
    expect(res.status).toBe(200)

    // Conversation revoke happened with the right payload + filter
    expect(convUpdateChain.update).toHaveBeenCalledWith({
      swiper_id: null,
      swiper_assigned_at: null,
    })
    expect(convUpdateChain.eq).toHaveBeenCalledWith('order_id', ORDER_ID)

    // System message includes the swiper's name in the new copy
    expect(mockSendSystemMessage).toHaveBeenCalledWith(
      ORDER_ID,
      'Swiper Alex Smith is no longer available. Finding you another swiper.'
    )
  })

  it('returns the updated order with cart_screenshot_urls signed', async () => {
    mockServerFrom
      .mockReturnValueOnce(
        dbResult({
          data: {
            id: ORDER_ID,
            orderer_id: ORDERER_ID,
            swiper_id: SWIPER_ID,
            status: 'in_progress',
          },
        })
      )
      .mockReturnValueOnce(dbResult({ data: { full_name: 'Alex Smith' } }))

    const path = 'pre-checkout/abc/00000000-0000-4000-8000-000000000010.jpg'
    const updatedOrder = {
      id: ORDER_ID,
      orderer_id: ORDERER_ID,
      swiper_id: null,
      school_id: '00000000-0000-4000-8000-000000000aaa',
      restaurant_name: 'Chipotle',
      cart_screenshot_urls: [path],
      status: 'open',
      subtotal_cents: 2500,
      total_cents: 1500,
      guest_name: null,
      guest_email: null,
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    }
    mockServiceFrom
      .mockReturnValueOnce(dbResult({ data: updatedOrder }))
      .mockReturnValueOnce(dbResult({ data: null, error: null }))

    const res = await callPatch('open')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cart_screenshot_urls).toEqual([`https://signed.test/${path}`])
    expect(mockSignCartScreenshotPaths).toHaveBeenCalledWith([path])
  })

  it('falls back to "Your swiper" when full_name is null', async () => {
    mockServerFrom
      .mockReturnValueOnce(
        dbResult({
          data: {
            id: ORDER_ID,
            orderer_id: ORDERER_ID,
            swiper_id: SWIPER_ID,
            status: 'in_progress',
          },
        })
      )
      .mockReturnValueOnce(dbResult({ data: { full_name: null } }))

    const updatedOrder = {
      id: ORDER_ID,
      orderer_id: ORDERER_ID,
      swiper_id: null,
      school_id: '00000000-0000-4000-8000-000000000aaa',
      restaurant_name: 'Chipotle',
      cart_screenshot_urls: [],
      status: 'open',
      subtotal_cents: 2500,
      total_cents: 1500,
      guest_name: null,
      guest_email: null,
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    }
    mockServiceFrom
      .mockReturnValueOnce(dbResult({ data: updatedOrder }))
      .mockReturnValueOnce(dbResult({ data: null, error: null }))

    const res = await callPatch('open')
    expect(res.status).toBe(200)
    expect(mockSendSystemMessage).toHaveBeenCalledWith(
      ORDER_ID,
      'Swiper Your swiper is no longer available. Finding you another swiper.'
    )
  })
})
