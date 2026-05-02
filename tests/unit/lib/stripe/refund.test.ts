/**
 * @file refund.test.ts
 * @description Unit tests for refundOrder. Verifies the Stripe refund call
 *   shape (uses payments.amount_cents — what was charged — NOT subtotal),
 *   idempotency-key forwarding, and the payments.status flip to 'refunded'.
 *   Called by: vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockServiceFrom, mockRefundsCreate } = vi.hoisted(() => ({
  mockServiceFrom: vi.fn(),
  mockRefundsCreate: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom })),
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripe: vi.fn(() => ({
    refunds: { create: mockRefundsCreate },
  })),
}))

import { refundOrder } from '@/lib/stripe/refund'

const ORDER_ID = '00000000-0000-4000-8000-000000000200'
const PI_ID = 'pi_test_999'
const IDEMPOTENCY = 'complaint-refund-abcdef'

function chain(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const mock: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'is']) {
    mock[m] = vi.fn(() => mock)
  }
  mock.single = vi.fn(() => Promise.resolve(result))
  mock.maybeSingle = vi.fn(() => Promise.resolve(result))
  mock.then = (resolve: (v: typeof result) => void) =>
    Promise.resolve(result).then(resolve)
  return mock
}

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay-1',
    amount_cents: 1500,
    status: 'succeeded',
    stripe_payment_intent_id: PI_ID,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('refundOrder', () => {
  it('refunds payments.amount_cents (what the orderer paid) — never the subtotal', async () => {
    const paymentChain = chain({ data: paymentRow() })
    const updateChain = chain({ data: null, error: null })
    mockServiceFrom
      .mockReturnValueOnce(paymentChain)
      .mockReturnValueOnce(updateChain)
    mockRefundsCreate.mockResolvedValue({ id: 're_1' })

    const result = await refundOrder(ORDER_ID, IDEMPOTENCY)

    expect(mockRefundsCreate).toHaveBeenCalledWith(
      { payment_intent: PI_ID, amount: 1500, metadata: { order_id: ORDER_ID } },
      { idempotencyKey: IDEMPOTENCY }
    )
    expect(updateChain.update).toHaveBeenCalledWith({ status: 'refunded' })
    expect(updateChain.eq).toHaveBeenCalledWith('order_id', ORDER_ID)
    expect(result).toEqual({ refundId: 're_1', amountCents: 1500 })
  })

  it('throws when no payment row exists for the order', async () => {
    const emptyChain = chain({ data: null })
    mockServiceFrom.mockReturnValueOnce(emptyChain)

    await expect(refundOrder(ORDER_ID, IDEMPOTENCY)).rejects.toThrow(/no payment/i)
    expect(mockRefundsCreate).not.toHaveBeenCalled()
  })

  it('throws when payment status is already refunded', async () => {
    const refundedChain = chain({ data: paymentRow({ status: 'refunded' }) })
    mockServiceFrom.mockReturnValueOnce(refundedChain)

    await expect(refundOrder(ORDER_ID, IDEMPOTENCY)).rejects.toThrow(/already refunded/i)
    expect(mockRefundsCreate).not.toHaveBeenCalled()
  })

  it('throws when payment status is not succeeded', async () => {
    const pendingChain = chain({ data: paymentRow({ status: 'pending' }) })
    mockServiceFrom.mockReturnValueOnce(pendingChain)

    await expect(refundOrder(ORDER_ID, IDEMPOTENCY)).rejects.toThrow(/not refundable/i)
    expect(mockRefundsCreate).not.toHaveBeenCalled()
  })

  it('throws with a clear message when stripe_payment_intent_id is null', async () => {
    const orphanChain = chain({
      data: paymentRow({ status: 'succeeded', stripe_payment_intent_id: null }),
    })
    mockServiceFrom.mockReturnValueOnce(orphanChain)

    await expect(refundOrder(ORDER_ID, IDEMPOTENCY)).rejects.toThrow(
      /no stripe_payment_intent_id/i
    )
    expect(mockRefundsCreate).not.toHaveBeenCalled()
  })

  it('propagates Stripe errors (route layer logs + leaves verdict pending)', async () => {
    const paymentChain = chain({ data: paymentRow() })
    mockServiceFrom.mockReturnValueOnce(paymentChain)
    mockRefundsCreate.mockRejectedValue(new Error('stripe down'))

    await expect(refundOrder(ORDER_ID, IDEMPOTENCY)).rejects.toThrow('stripe down')
  })

  it('forwards a unique idempotency key so retries are safe', async () => {
    const paymentChain = chain({ data: paymentRow() })
    const updateChain = chain({ data: null })
    mockServiceFrom
      .mockReturnValueOnce(paymentChain)
      .mockReturnValueOnce(updateChain)
    mockRefundsCreate.mockResolvedValue({ id: 're_2' })

    await refundOrder(ORDER_ID, 'complaint-refund-xyz')

    expect(mockRefundsCreate.mock.calls[0][1]).toEqual({
      idempotencyKey: 'complaint-refund-xyz',
    })
  })
})
