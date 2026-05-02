/**
 * @file sweep-stale-orders.test.ts
 * @description Unit tests for the 24h stale-order sweep cron — verifies auth
 *   (CRON_SECRET bearer), the .in('status', ['open','in_progress']) +
 *   .lt('created_at', cutoff) query, paymentIntents.cancel per stale order
 *   with idempotency key, system-message side-effect when a conversation
 *   exists, and Promise.allSettled batch tolerance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockServiceFrom, mockPaymentIntentsCancel } = vi.hoisted(() => ({
  mockServiceFrom: vi.fn(),
  mockPaymentIntentsCancel: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom })),
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripe: vi.fn(() => ({
    paymentIntents: { cancel: mockPaymentIntentsCancel },
  })),
}))

import { GET } from '@/app/api/cron/sweep-stale-orders/route'

const CRON_SECRET = 'test-cron-secret-abc'
const ORDER_A = '00000000-0000-4000-8000-000000000a01'
const ORDER_B = '00000000-0000-4000-8000-000000000a02'
const PI_A = 'pi_stale_a'
const PI_B = 'pi_stale_b'

function chain(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const mock: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'is', 'lt']) {
    mock[m] = vi.fn(() => mock)
  }
  mock.single = vi.fn(() => Promise.resolve(result))
  mock.maybeSingle = vi.fn(() => Promise.resolve(result))
  mock.then = (resolve: (v: typeof result) => void) =>
    Promise.resolve(result).then(resolve)
  return mock
}

function buildRequest(authHeader?: string): NextRequest {
  return new NextRequest('http://localhost/api/cron/sweep-stale-orders', {
    method: 'GET',
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = CRON_SECRET
  mockPaymentIntentsCancel.mockResolvedValue({ id: 'pi_cancelled' })
})

describe('GET /api/cron/sweep-stale-orders', () => {
  describe('auth', () => {
    it('returns 401 with missing Authorization header', async () => {
      const res = await GET(buildRequest())
      expect(res.status).toBe(401)
    })

    it('returns 401 with wrong bearer secret', async () => {
      const res = await GET(buildRequest('Bearer wrong-secret'))
      expect(res.status).toBe(401)
    })

    it('returns 500 when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await GET(buildRequest('Bearer anything'))
      expect(res.status).toBe(500)
      consoleSpy.mockRestore()
    })

    it('passes auth with the matching bearer token', async () => {
      mockServiceFrom.mockReturnValueOnce(chain({ data: [] }))
      const res = await GET(buildRequest(`Bearer ${CRON_SECRET}`))
      expect(res.status).toBe(200)
    })
  })

  describe('query', () => {
    it('queries orders WHERE status IN (open, in_progress) AND created_at < (now - 24h)', async () => {
      const ordersChain = chain({ data: [] })
      mockServiceFrom.mockReturnValueOnce(ordersChain)

      const before = Date.now()
      const res = await GET(buildRequest(`Bearer ${CRON_SECRET}`))
      const after = Date.now()
      expect(res.status).toBe(200)

      expect(ordersChain.in).toHaveBeenCalledWith('status', ['open', 'in_progress'])
      const ltCall = (ordersChain.lt as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(ltCall[0]).toBe('created_at')
      // The cutoff is 24h ago; verify it's in that ballpark.
      const cutoffMs = new Date(ltCall[1] as string).getTime()
      const expectedMs = before - 24 * 60 * 60 * 1000
      expect(cutoffMs).toBeGreaterThanOrEqual(expectedMs - 1000)
      expect(cutoffMs).toBeLessThanOrEqual(after - 24 * 60 * 60 * 1000 + 1000)
    })
  })

  describe('cancel side-effects', () => {
    it('calls paymentIntents.cancel per stale order with idempotency key cancel-${orderId}', async () => {
      const ordersQuery = chain({
        data: [
          { id: ORDER_A, stripe_payment_intent_id: PI_A },
          { id: ORDER_B, stripe_payment_intent_id: PI_B },
        ],
      })
      mockServiceFrom
        .mockReturnValueOnce(ordersQuery)
        // For each order: payments.select (no row) + orders.update + conversations.select
        .mockReturnValue(chain({ data: null, error: null }))

      const res = await GET(buildRequest(`Bearer ${CRON_SECRET}`))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.swept).toBe(2)
      expect(body.failed).toBe(0)

      expect(mockPaymentIntentsCancel).toHaveBeenCalledWith(
        PI_A,
        undefined,
        expect.objectContaining({ idempotencyKey: `cancel-${ORDER_A}` })
      )
      expect(mockPaymentIntentsCancel).toHaveBeenCalledWith(
        PI_B,
        undefined,
        expect.objectContaining({ idempotencyKey: `cancel-${ORDER_B}` })
      )
    })

    it('skips cancel + status flip when payments.status is succeeded (already-captured guard)', async () => {
      const ordersQuery = chain({
        data: [{ id: ORDER_A, stripe_payment_intent_id: PI_A }],
      })
      const paymentLookup = chain({ data: { status: 'succeeded' } })

      mockServiceFrom
        .mockReturnValueOnce(ordersQuery)
        .mockReturnValueOnce(paymentLookup)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const res = await GET(buildRequest(`Bearer ${CRON_SECRET}`))
      expect(res.status).toBe(200)
      const body = await res.json()
      // Settled payment = early return (counted as swept since allSettled fulfills); no DB mutation, no Stripe call.
      expect(body.swept).toBe(1)
      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled()
      // Only the orders query + the payments lookup were issued.
      expect(mockServiceFrom).toHaveBeenCalledTimes(2)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`order ${ORDER_A} has settled payment (succeeded)`)
      )

      consoleSpy.mockRestore()
    })

    it('skips cancel + status flip when payments.status is refunded (already-refunded guard)', async () => {
      const ordersQuery = chain({
        data: [{ id: ORDER_A, stripe_payment_intent_id: PI_A }],
      })
      const paymentLookup = chain({ data: { status: 'refunded' } })

      mockServiceFrom
        .mockReturnValueOnce(ordersQuery)
        .mockReturnValueOnce(paymentLookup)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const res = await GET(buildRequest(`Bearer ${CRON_SECRET}`))
      expect(res.status).toBe(200)
      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('proceeds with cancel when payments.status is pending (auth-only)', async () => {
      const ordersQuery = chain({
        data: [{ id: ORDER_A, stripe_payment_intent_id: PI_A }],
      })
      const paymentLookup = chain({ data: { status: 'pending' } })
      const orderUpdate = chain({ data: null, error: null })
      const conversationLookup = chain({ data: null })

      mockServiceFrom
        .mockReturnValueOnce(ordersQuery)
        .mockReturnValueOnce(paymentLookup)
        .mockReturnValueOnce(orderUpdate)
        .mockReturnValueOnce(conversationLookup)

      const res = await GET(buildRequest(`Bearer ${CRON_SECRET}`))
      expect(res.status).toBe(200)
      expect(mockPaymentIntentsCancel).toHaveBeenCalledWith(PI_A, undefined, expect.any(Object))
      expect(orderUpdate.update).toHaveBeenCalledWith({ status: 'cancelled' })
    })

    it('flips orders.status to cancelled even when paymentIntents.cancel throws (auth not yet captured)', async () => {
      const ordersQuery = chain({
        data: [{ id: ORDER_A, stripe_payment_intent_id: PI_A }],
      })
      const paymentLookup = chain({ data: { status: 'pending' } })
      const orderUpdate = chain({ data: null, error: null })
      const conversationLookup = chain({ data: null })

      mockServiceFrom
        .mockReturnValueOnce(ordersQuery)
        .mockReturnValueOnce(paymentLookup)
        .mockReturnValueOnce(orderUpdate)
        .mockReturnValueOnce(conversationLookup)

      mockPaymentIntentsCancel.mockRejectedValueOnce(new Error('PI already canceled'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const res = await GET(buildRequest(`Bearer ${CRON_SECRET}`))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.swept).toBe(1)

      expect(orderUpdate.update).toHaveBeenCalledWith({ status: 'cancelled' })
      expect(orderUpdate.eq).toHaveBeenCalledWith('id', ORDER_A)

      consoleSpy.mockRestore()
    })

    it('inserts a system message into the conversation when one exists', async () => {
      const ordersQuery = chain({
        data: [{ id: ORDER_A, stripe_payment_intent_id: PI_A }],
      })
      const paymentLookup = chain({ data: null })
      const orderUpdate = chain({ data: null, error: null })
      const conversationLookup = chain({ data: { id: 'conv-1' } })
      const messageInsert = chain({ data: null, error: null })

      mockServiceFrom
        .mockReturnValueOnce(ordersQuery)
        .mockReturnValueOnce(paymentLookup)
        .mockReturnValueOnce(orderUpdate)
        .mockReturnValueOnce(conversationLookup)
        .mockReturnValueOnce(messageInsert)

      const res = await GET(buildRequest(`Bearer ${CRON_SECRET}`))
      expect(res.status).toBe(200)

      expect(messageInsert.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation_id: 'conv-1',
          sender_id: null,
          message_type: 'system',
          body: 'Order auto-cancelled after 24 hours.',
        })
      )
    })

    it('continues the batch when a single order fails (Promise.allSettled)', async () => {
      const ordersQuery = chain({
        data: [
          { id: ORDER_A, stripe_payment_intent_id: PI_A },
          { id: ORDER_B, stripe_payment_intent_id: PI_B },
        ],
      })

      // Both orders run in parallel via Promise.allSettled, so mockServiceFrom
      // is called in interleaved order. Dispatch by table name + per-table
      // call counter to make ordering deterministic.
      let ordersTableCalls = 0
      let updateCalls = 0
      mockServiceFrom.mockImplementation((table: string) => {
        if (table === 'orders') {
          ordersTableCalls += 1
          if (ordersTableCalls === 1) return ordersQuery
          // 2nd+ calls to orders are the per-order .update(...) chains.
          updateCalls += 1
          return updateCalls === 1
            ? chain({ data: null, error: { message: 'db down' } })
            : chain({ data: null, error: null })
        }
        if (table === 'payments') return chain({ data: null })
        if (table === 'conversations') return chain({ data: null })
        return chain({ data: null, error: null })
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const res = await GET(buildRequest(`Bearer ${CRON_SECRET}`))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.total).toBe(2)
      // One order's update threw (rejected), the other resolved.
      expect(body.swept).toBe(1)
      expect(body.failed).toBe(1)

      consoleSpy.mockRestore()
    })

    it('skips paymentIntents.cancel when stripe_payment_intent_id is null (legacy data)', async () => {
      const ordersQuery = chain({
        data: [{ id: ORDER_A, stripe_payment_intent_id: null }],
      })
      mockServiceFrom
        .mockReturnValueOnce(ordersQuery)
        // No payments lookup because PI is null; jump straight to orders.update + conversations.
        .mockReturnValueOnce(chain({ data: null, error: null }))
        .mockReturnValueOnce(chain({ data: null }))

      const res = await GET(buildRequest(`Bearer ${CRON_SECRET}`))
      expect(res.status).toBe(200)
      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled()
    })
  })

  describe('empty result', () => {
    it('returns swept=0 with no orders to process', async () => {
      mockServiceFrom.mockReturnValueOnce(chain({ data: [] }))
      const res = await GET(buildRequest(`Bearer ${CRON_SECRET}`))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toMatchObject({ swept: 0, failed: 0, total: 0 })
      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled()
    })
  })
})
