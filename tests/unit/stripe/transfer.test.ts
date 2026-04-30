/**
 * @file transfer.test.ts
 * @description Unit tests for transferToSwiper — verifies the Stripe transfer
 *   side-effect, idempotency, and that transfer failures are surfaced via the
 *   payments.transfer_failed_at column rather than swallowed silently.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// transfer.ts imports `server-only`, which throws under vitest's jsdom env.
vi.mock('server-only', () => ({}))

const { mockServiceFrom, mockTransfersCreate, mockPaymentIntentsRetrieve } =
  vi.hoisted(() => ({
    mockServiceFrom: vi.fn(),
    mockTransfersCreate: vi.fn(),
    mockPaymentIntentsRetrieve: vi.fn(),
  }))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom })),
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripe: vi.fn(() => ({
    transfers: { create: mockTransfersCreate },
    paymentIntents: { retrieve: mockPaymentIntentsRetrieve },
  })),
}))

import { transferToSwiper } from '@/lib/stripe/transfer'

const ORDER_ID = '00000000-0000-4000-8000-000000000100'
const SWIPER_ID = '00000000-0000-4000-8000-000000000001'
const PI_ID = 'pi_test_123'
const CHARGE_ID = 'ch_test_abc'

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
    payee_id: null,
    amount_cents: 2000,
    platform_fee_cents: 200,
    stripe_payment_intent_id: PI_ID,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('transferToSwiper', () => {
  it('creates a Stripe transfer with source_transaction and marks payment.payee_id when payment is unpaid', async () => {
    const paymentChain = chain({ data: paymentRow() })
    const accountChain = chain({ data: { stripe_account_id: 'acct_swiper' } })
    const payeeUpdateChain = chain({ data: null, error: null })
    mockServiceFrom
      .mockReturnValueOnce(paymentChain) // payments.select
      .mockReturnValueOnce(accountChain) // stripe_accounts.select
      .mockReturnValueOnce(payeeUpdateChain) // payments.update payee_id

    mockPaymentIntentsRetrieve.mockResolvedValue({ latest_charge: CHARGE_ID })
    mockTransfersCreate.mockResolvedValue({ id: 'tr_1' })

    await transferToSwiper(ORDER_ID, SWIPER_ID)

    expect(mockPaymentIntentsRetrieve).toHaveBeenCalledWith(PI_ID)
    expect(mockTransfersCreate).toHaveBeenCalledWith(
      {
        amount: 1800,
        currency: 'usd',
        destination: 'acct_swiper',
        source_transaction: CHARGE_ID,
        metadata: { order_id: ORDER_ID },
      },
      { idempotencyKey: `transfer-${ORDER_ID}` }
    )
    expect(payeeUpdateChain.update).toHaveBeenCalledWith({ payee_id: SWIPER_ID })
  })

  it('passes source_transaction when latest_charge is returned as a string', async () => {
    const paymentChain = chain({ data: paymentRow() })
    const accountChain = chain({ data: { stripe_account_id: 'acct_swiper' } })
    const payeeUpdateChain = chain({ data: null, error: null })
    mockServiceFrom
      .mockReturnValueOnce(paymentChain)
      .mockReturnValueOnce(accountChain)
      .mockReturnValueOnce(payeeUpdateChain)

    mockPaymentIntentsRetrieve.mockResolvedValue({ latest_charge: 'ch_str' })
    mockTransfersCreate.mockResolvedValue({ id: 'tr_1' })

    await transferToSwiper(ORDER_ID, SWIPER_ID)

    expect(mockTransfersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ source_transaction: 'ch_str' }),
      expect.anything()
    )
  })

  it('passes source_transaction when latest_charge is returned as an expanded charge object', async () => {
    const paymentChain = chain({ data: paymentRow() })
    const accountChain = chain({ data: { stripe_account_id: 'acct_swiper' } })
    const payeeUpdateChain = chain({ data: null, error: null })
    mockServiceFrom
      .mockReturnValueOnce(paymentChain)
      .mockReturnValueOnce(accountChain)
      .mockReturnValueOnce(payeeUpdateChain)

    mockPaymentIntentsRetrieve.mockResolvedValue({ latest_charge: { id: 'ch_obj' } })
    mockTransfersCreate.mockResolvedValue({ id: 'tr_1' })

    await transferToSwiper(ORDER_ID, SWIPER_ID)

    expect(mockTransfersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ source_transaction: 'ch_obj' }),
      expect.anything()
    )
  })

  it('marks transfer_failed_at and skips the transfer when latest_charge is null', async () => {
    const paymentChain = chain({ data: paymentRow() })
    const accountChain = chain({ data: { stripe_account_id: 'acct_swiper' } })
    const failureUpdateChain = chain({ data: null, error: null })
    mockServiceFrom
      .mockReturnValueOnce(paymentChain) // payments.select
      .mockReturnValueOnce(accountChain) // stripe_accounts.select
      .mockReturnValueOnce(failureUpdateChain) // payments.update transfer_failed_at

    mockPaymentIntentsRetrieve.mockResolvedValue({ latest_charge: null })

    await transferToSwiper(ORDER_ID, SWIPER_ID)

    expect(mockTransfersCreate).not.toHaveBeenCalled()
    expect(failureUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ transfer_failed_at: expect.any(String) })
    )
    expect(failureUpdateChain.eq).toHaveBeenCalledWith('order_id', ORDER_ID)
    // payments.select + stripe_accounts.select + payments.update(transfer_failed_at) === 3
    // No payee_id update.
    expect(mockServiceFrom).toHaveBeenCalledTimes(3)
  })

  it('marks transfer_failed_at and skips the transfer when paymentIntents.retrieve throws', async () => {
    const paymentChain = chain({ data: paymentRow() })
    const accountChain = chain({ data: { stripe_account_id: 'acct_swiper' } })
    const failureUpdateChain = chain({ data: null, error: null })
    mockServiceFrom
      .mockReturnValueOnce(paymentChain)
      .mockReturnValueOnce(accountChain)
      .mockReturnValueOnce(failureUpdateChain)

    mockPaymentIntentsRetrieve.mockRejectedValue(new Error('pi gone'))

    await transferToSwiper(ORDER_ID, SWIPER_ID)

    expect(mockTransfersCreate).not.toHaveBeenCalled()
    expect(failureUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ transfer_failed_at: expect.any(String) })
    )
    expect(failureUpdateChain.eq).toHaveBeenCalledWith('order_id', ORDER_ID)
    expect(mockServiceFrom).toHaveBeenCalledTimes(3)
  })

  it('does NOT write orders.status to "paid" (the OrderStatus enum has no such value)', async () => {
    const paymentChain = chain({ data: paymentRow() })
    const accountChain = chain({ data: { stripe_account_id: 'acct_swiper' } })
    const payeeUpdateChain = chain({ data: null, error: null })
    mockServiceFrom
      .mockReturnValueOnce(paymentChain)
      .mockReturnValueOnce(accountChain)
      .mockReturnValueOnce(payeeUpdateChain)

    mockPaymentIntentsRetrieve.mockResolvedValue({ latest_charge: CHARGE_ID })
    mockTransfersCreate.mockResolvedValue({ id: 'tr_1' })

    await transferToSwiper(ORDER_ID, SWIPER_ID)

    // No call to from('orders') anywhere in the helper
    for (const call of mockServiceFrom.mock.calls) {
      expect(call[0]).not.toBe('orders')
    }
  })

  it('marks payments.transfer_failed_at when stripe.transfers.create rejects', async () => {
    const paymentChain = chain({ data: paymentRow() })
    const accountChain = chain({ data: { stripe_account_id: 'acct_swiper' } })
    const failureUpdateChain = chain({ data: null, error: null })
    mockServiceFrom
      .mockReturnValueOnce(paymentChain) // payments.select
      .mockReturnValueOnce(accountChain) // stripe_accounts.select
      .mockReturnValueOnce(failureUpdateChain) // payments.update transfer_failed_at

    mockPaymentIntentsRetrieve.mockResolvedValue({ latest_charge: CHARGE_ID })
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

    expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled()
    expect(mockTransfersCreate).not.toHaveBeenCalled()
    // Only the initial payments.select happens; no follow-up update
    expect(mockServiceFrom).toHaveBeenCalledTimes(1)
  })

  it('does nothing when payment is already paid (payee_id set)', async () => {
    const paidChain = chain({ data: paymentRow({ payee_id: SWIPER_ID }) })
    mockServiceFrom.mockReturnValueOnce(paidChain)

    await transferToSwiper(ORDER_ID, SWIPER_ID)

    expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled()
    expect(mockTransfersCreate).not.toHaveBeenCalled()
    expect(mockServiceFrom).toHaveBeenCalledTimes(1)
  })
})
