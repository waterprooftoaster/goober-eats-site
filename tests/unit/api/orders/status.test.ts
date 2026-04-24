/**
 * @file status.test.ts
 * @description Unit tests for PATCH /api/orders/[id]/status covering
 *   finding #1 (refund on orderer cancel) and the canComplete dispute
 *   gate added in Wave B.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockServerFrom, mockServiceFrom, stripeRefunds, mockTransferToSwiper, mockSendSystemMessage } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockServerFrom: vi.fn(),
    mockServiceFrom: vi.fn(),
    stripeRefunds: { create: vi.fn() },
    mockTransferToSwiper: vi.fn(),
    mockSendSystemMessage: vi.fn(),
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
vi.mock('@/lib/stripe/client', () => ({
  getStripe: () => ({ refunds: stripeRefunds }),
}))
vi.mock('@/lib/stripe/transfer', () => ({
  transferToSwiper: mockTransferToSwiper,
}))
vi.mock('@/lib/chat/system-messages', () => ({
  sendSystemMessage: mockSendSystemMessage,
}))

import { PATCH } from '@/app/api/orders/[id]/status/route'

// ---------------------------------------------------------------------------

interface MockChain {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  then: (resolve: (v: { data?: unknown; error?: unknown }) => void) => Promise<unknown>
}

function dbResult(
  result: { data?: unknown; error?: unknown } = { data: null, error: null }
): MockChain {
  const chain: Partial<MockChain> = {}
  for (const m of ['select', 'insert', 'update', 'eq', 'is'] as const) {
    ;(chain as Record<string, unknown>)[m] = vi.fn(() => chain)
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve(result))
  chain.single = vi.fn(() => Promise.resolve(result))
  chain.then = (resolve) => Promise.resolve(result).then(resolve)
  return chain as MockChain
}

const ORDERER_ID = '00000000-0000-4000-8000-000000000001'
const SWIPER_ID = '00000000-0000-4000-8000-000000000002'
const ORDER_ID = '00000000-0000-4000-8000-000000000100'
const PI_ID = 'pi_test_abc'

async function callPatch(body: { status: string }): Promise<Response> {
  const req = new NextRequest(`http://localhost/api/orders/${ORDER_ID}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return PATCH(req, { params: Promise.resolve({ id: ORDER_ID }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: ORDERER_ID } }, error: null })
})

describe('PATCH /api/orders/[id]/status — cancel (finding #1: refund)', () => {
  function setupOpenOrderAsOrderer() {
    mockServerFrom.mockReset()
    mockServerFrom.mockReturnValueOnce(
      dbResult({
        data: {
          id: ORDER_ID,
          orderer_id: ORDERER_ID,
          swiper_id: null,
          status: 'open',
        },
      })
    )
  }

  it('refunds the orderer via Stripe BEFORE updating order status', async () => {
    setupOpenOrderAsOrderer()

    let refundCalled = false
    stripeRefunds.create.mockImplementation(async () => {
      refundCalled = true
      return { id: 're_1' }
    })

    const paymentsRead = dbResult({
      data: { id: 'pay-1', stripe_payment_intent_id: PI_ID, status: 'succeeded' },
    })
    const paymentsUpdate = dbResult()
    const ordersUpdate = dbResult({
      data: {
        id: ORDER_ID,
        orderer_id: ORDERER_ID,
        swiper_id: null,
        school_id: 'school-1',
        restaurant_name: 'Chipotle',
        cart_screenshot_urls: [],
        status: 'cancelled',
        total_cents: 1500,
        guest_name: null,
        guest_phone: null,
        created_at: 't',
        updated_at: 't',
      },
    })

    let paymentsCalls = 0
    mockServiceFrom.mockImplementation((): MockChain => {
      // Same table-name is passed (all 'payments' or 'orders'); track call order.
      paymentsCalls += 1
      if (paymentsCalls === 1) return paymentsRead
      return paymentsUpdate
    })

    // Server client handles the orders.update at the end (cancel uses user client).
    mockServerFrom.mockReturnValueOnce(ordersUpdate)

    const res = await callPatch({ status: 'cancelled' })
    expect(res.status).toBe(200)
    expect(refundCalled).toBe(true)
    expect(stripeRefunds.create).toHaveBeenCalledWith(
      { payment_intent: PI_ID },
      expect.objectContaining({ idempotencyKey: `refund-${ORDER_ID}` })
    )
    expect(paymentsUpdate.update).toHaveBeenCalledWith({ status: 'refunded' })
    expect(ordersUpdate.update).toHaveBeenCalledWith({ status: 'cancelled' })
  })

  it('returns 500 and leaves order open when Stripe refund fails', async () => {
    setupOpenOrderAsOrderer()

    stripeRefunds.create.mockRejectedValue(new Error('stripe down'))

    const paymentsRead = dbResult({
      data: { id: 'pay-1', stripe_payment_intent_id: PI_ID, status: 'succeeded' },
    })
    mockServiceFrom.mockReturnValue(paymentsRead)

    // No orders.update call expected on failure.
    const res = await callPatch({ status: 'cancelled' })
    expect(res.status).toBe(500)
    // The only mockServerFrom chain is the initial order read.
    expect(mockServerFrom).toHaveBeenCalledTimes(1)
  })

  it('returns 403 when a non-orderer tries to cancel', async () => {
    mockServerFrom.mockReturnValueOnce(
      dbResult({
        data: {
          id: ORDER_ID,
          orderer_id: SWIPER_ID,
          swiper_id: null,
          status: 'open',
        },
      })
    )
    const res = await callPatch({ status: 'cancelled' })
    expect(res.status).toBe(403)
    expect(stripeRefunds.create).not.toHaveBeenCalled()
  })

  it('is a no-op refund when payment is already refunded (idempotent with webhook)', async () => {
    setupOpenOrderAsOrderer()
    const paymentsRead = dbResult({
      data: { id: 'pay-1', stripe_payment_intent_id: PI_ID, status: 'refunded' },
    })
    const ordersUpdate = dbResult({
      data: {
        id: ORDER_ID,
        orderer_id: ORDERER_ID,
        swiper_id: null,
        school_id: 'school-1',
        restaurant_name: 'Chipotle',
        cart_screenshot_urls: [],
        status: 'cancelled',
        total_cents: 1500,
        guest_name: null,
        guest_phone: null,
        created_at: 't',
        updated_at: 't',
      },
    })
    mockServiceFrom.mockReturnValue(paymentsRead)
    mockServerFrom.mockReturnValueOnce(ordersUpdate)

    const res = await callPatch({ status: 'cancelled' })
    expect(res.status).toBe(200)
    expect(stripeRefunds.create).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/orders/[id]/status — complete (canComplete gate)', () => {
  it('returns 400 when payment is disputed (finding #2 guard)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: SWIPER_ID } }, error: null })

    mockServerFrom.mockReset()
    mockServerFrom.mockReturnValueOnce(
      dbResult({
        data: {
          id: ORDER_ID,
          orderer_id: ORDERER_ID,
          swiper_id: SWIPER_ID,
          status: 'in_progress',
        },
      })
    )

    // Service client payment lookup returns a disputed payment.
    mockServiceFrom.mockReturnValueOnce(
      dbResult({
        data: {
          id: 'pay-1',
          order_id: ORDER_ID,
          stripe_payment_intent_id: PI_ID,
          amount_cents: 1500,
          platform_fee_cents: 150,
          status: 'disputed',
          payer_id: ORDERER_ID,
          payee_id: null,
          created_at: 't',
        },
      })
    )

    const res = await callPatch({ status: 'completed' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/disputed/i)
    expect(mockTransferToSwiper).not.toHaveBeenCalled()
  })

  it('happy-path complete: triggers transfer, sends system message, returns 200', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: SWIPER_ID } }, error: null })

    // Server chain: orders read, conversations read, messages count, orders update
    mockServerFrom.mockReset()
    mockServerFrom.mockReturnValueOnce(
      dbResult({
        data: {
          id: ORDER_ID,
          orderer_id: ORDERER_ID,
          swiper_id: SWIPER_ID,
          status: 'in_progress',
        },
      })
    )
    // conversations.select
    mockServerFrom.mockReturnValueOnce(dbResult({ data: { id: 'conv-1' } }))
    // messages count
    mockServerFrom.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ count: 1, error: null })),
        })),
      })),
      // unused; satisfy the mock chain interface minimally
    } as unknown as ReturnType<typeof dbResult>)
    // orders.update (cancel uses user client; complete also uses user client)
    mockServerFrom.mockReturnValueOnce(
      dbResult({
        data: {
          id: ORDER_ID,
          orderer_id: ORDERER_ID,
          swiper_id: SWIPER_ID,
          school_id: 'school-1',
          restaurant_name: 'Chipotle',
          cart_screenshot_urls: [],
          status: 'completed',
          total_cents: 1500,
          guest_name: null,
          guest_phone: null,
          created_at: 't',
          updated_at: 't',
        },
      })
    )

    // service client: payments lookup (canComplete) returns a succeeded payment
    mockServiceFrom.mockReturnValueOnce(
      dbResult({
        data: {
          id: 'pay-1',
          order_id: ORDER_ID,
          stripe_payment_intent_id: PI_ID,
          amount_cents: 1500,
          platform_fee_cents: 150,
          status: 'succeeded',
          payer_id: ORDERER_ID,
          payee_id: null,
          created_at: 't',
        },
      })
    )

    mockTransferToSwiper.mockResolvedValue(undefined)
    mockSendSystemMessage.mockResolvedValue(undefined)

    const res = await callPatch({ status: 'completed' })
    expect(res.status).toBe(200)
    expect(mockTransferToSwiper).toHaveBeenCalledWith(ORDER_ID, SWIPER_ID, 1500)
    expect(mockSendSystemMessage).toHaveBeenCalled()
  })
})
