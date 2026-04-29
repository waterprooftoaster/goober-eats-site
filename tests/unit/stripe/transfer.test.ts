/**
 * @file transfer.test.ts
 * @description Unit tests for transferToSwiper — verifies the Stripe transfer
 *   side-effect, idempotency, and that transfer failures are surfaced via the
 *   payments.transfer_failed_at column rather than swallowed silently.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// transfer.ts imports `server-only`, which throws under vitest's jsdom env.
vi.mock('server-only', () => ({}))

const { mockServiceFrom, mockTransfersCreate } = vi.hoisted(() => ({
  mockServiceFrom: vi.fn(),
  mockTransfersCreate: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom })),
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripe: vi.fn(() => ({
    transfers: { create: mockTransfersCreate },
  })),
}))

import { transferToSwiper } from '@/lib/stripe/transfer'

const ORDER_ID = '00000000-0000-4000-8000-000000000100'
const SWIPER_ID = '00000000-0000-4000-8000-000000000001'

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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('transferToSwiper', () => {
  it('creates a Stripe transfer and marks payment.payee_id when payment is unpaid', async () => {
    const paymentChain = chain({ data: { id: 'pay-1', payee_id: null, amount_cents: 2000, platform_fee_cents: 200 } })
    const accountChain = chain({ data: { stripe_account_id: 'acct_swiper' } })
    const payeeUpdateChain = chain({ data: null, error: null })
    mockServiceFrom
      .mockReturnValueOnce(paymentChain) // payments.select
      .mockReturnValueOnce(accountChain) // stripe_accounts.select
      .mockReturnValueOnce(payeeUpdateChain) // payments.update payee_id

    mockTransfersCreate.mockResolvedValue({ id: 'tr_1' })

    await transferToSwiper(ORDER_ID, SWIPER_ID)

    expect(mockTransfersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1800,
        currency: 'usd',
        destination: 'acct_swiper',
        metadata: { order_id: ORDER_ID },
      }),
      expect.objectContaining({ idempotencyKey: `transfer-${ORDER_ID}` })
    )
    expect(payeeUpdateChain.update).toHaveBeenCalledWith({ payee_id: SWIPER_ID })
  })

  it('does NOT write orders.status to "paid" (the OrderStatus enum has no such value)', async () => {
    const paymentChain = chain({ data: { id: 'pay-1', payee_id: null, amount_cents: 2000, platform_fee_cents: 200 } })
    const accountChain = chain({ data: { stripe_account_id: 'acct_swiper' } })
    const payeeUpdateChain = chain({ data: null, error: null })
    mockServiceFrom
      .mockReturnValueOnce(paymentChain)
      .mockReturnValueOnce(accountChain)
      .mockReturnValueOnce(payeeUpdateChain)

    mockTransfersCreate.mockResolvedValue({ id: 'tr_1' })

    await transferToSwiper(ORDER_ID, SWIPER_ID)

    // No call to from('orders') anywhere in the helper
    for (const call of mockServiceFrom.mock.calls) {
      expect(call[0]).not.toBe('orders')
    }
  })

  it('marks payments.transfer_failed_at when stripe.transfers.create rejects', async () => {
    const paymentChain = chain({ data: { id: 'pay-1', payee_id: null, amount_cents: 2000, platform_fee_cents: 200 } })
    const accountChain = chain({ data: { stripe_account_id: 'acct_swiper' } })
    const failureUpdateChain = chain({ data: null, error: null })
    mockServiceFrom
      .mockReturnValueOnce(paymentChain) // payments.select
      .mockReturnValueOnce(accountChain) // stripe_accounts.select
      .mockReturnValueOnce(failureUpdateChain) // payments.update transfer_failed_at

    mockTransfersCreate.mockRejectedValue(new Error('stripe down'))

    await expect(transferToSwiper(ORDER_ID, SWIPER_ID)).resolves.toBeUndefined()

    // transfer_failed_at should be set on the payment row
    expect(failureUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ transfer_failed_at: expect.any(String) })
    )
    expect(failureUpdateChain.eq).toHaveBeenCalledWith('order_id', ORDER_ID)
  })

  it('does nothing (no transfer, no failure mark) when payment is missing', async () => {
    const emptyPaymentChain = chain({ data: null })
    mockServiceFrom.mockReturnValueOnce(emptyPaymentChain)

    await transferToSwiper(ORDER_ID, SWIPER_ID)

    expect(mockTransfersCreate).not.toHaveBeenCalled()
    // Only the initial payments.select happens; no follow-up update
    expect(mockServiceFrom).toHaveBeenCalledTimes(1)
  })

  it('does nothing when payment is already paid (payee_id set)', async () => {
    const paidChain = chain({ data: { id: 'pay-1', payee_id: SWIPER_ID, amount_cents: 2000, platform_fee_cents: 200 } })
    mockServiceFrom.mockReturnValueOnce(paidChain)

    await transferToSwiper(ORDER_ID, SWIPER_ID)

    expect(mockTransfersCreate).not.toHaveBeenCalled()
    expect(mockServiceFrom).toHaveBeenCalledTimes(1)
  })
})
