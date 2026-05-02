/**
 * @file stripeAssertions.test.ts
 * @description Unit test for the live-money assertion helper at
 *   tests/e2e/lib/stripeAssertions.ts. Mocks Stripe SDK + Supabase client to
 *   exercise every error branch without hitting the network. The helper itself
 *   runs in Playwright + the assert-order-settled CLI; this suite gates it.
 *   Called by: npm run test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// stripeAssertions imports lib/stripe/sdk (no `server-only`) but we still mock
// it to avoid touching the real Stripe network.
const { mockPaymentIntentsRetrieve, mockTransfersList, mockSupabaseFrom } =
  vi.hoisted(() => ({
    mockPaymentIntentsRetrieve: vi.fn(),
    mockTransfersList: vi.fn(),
    mockSupabaseFrom: vi.fn(),
  }))

vi.mock('@/lib/stripe/sdk', () => ({
  getStripe: vi.fn(() => ({
    paymentIntents: { retrieve: mockPaymentIntentsRetrieve },
    transfers: { list: mockTransfersList },
  })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockSupabaseFrom })),
}))

import { assertOrderSettled } from '@/tests/e2e/lib/stripeAssertions'

const ORDER_ID = '00000000-0000-4000-8000-000000000001'
const PI_ID = 'pi_test_123'
const CHARGE_ID = 'ch_test_abc'
const TRANSFER_ID = 'tr_test_xyz'

function chain(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const m: Record<string, unknown> = {}
  for (const fn of ['select', 'eq']) m[fn] = vi.fn(() => m)
  m.single = vi.fn(() => Promise.resolve(result))
  m.maybeSingle = vi.fn(() => Promise.resolve(result))
  return m
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.TEST_SUPABASE_URL = 'http://127.0.0.1:64361'
  process.env.TEST_SUPABASE_SECRET_KEY = 'sb_secret_test'
})

describe('assertOrderSettled', () => {
  it('returns settlement summary on the happy path', async () => {
    mockSupabaseFrom
      .mockReturnValueOnce(
        chain({
          data: { stripe_payment_intent_id: PI_ID, total_cents: 1100 },
        })
      )
      .mockReturnValueOnce(
        chain({
          data: { amount_cents: 1100, platform_fee_cents: 110 },
        })
      )

    mockPaymentIntentsRetrieve.mockResolvedValue({
      id: PI_ID,
      status: 'succeeded',
      amount_received: 1100,
      latest_charge: {
        id: CHARGE_ID,
        paid: true,
        captured: true,
        balance_transaction: 'txn_charge_bt',
      },
    })

    mockTransfersList.mockResolvedValue({
      data: [
        {
          id: TRANSFER_ID,
          amount: 990,
          source_transaction: CHARGE_ID,
          metadata: { order_id: ORDER_ID },
        },
      ],
    })

    const result = await assertOrderSettled(ORDER_ID, { pollIntervalMs: 10, timeoutMs: 100 })

    expect(result).toEqual({
      paymentIntentId: PI_ID,
      chargeId: CHARGE_ID,
      transferId: TRANSFER_ID,
      chargeBalanceTxnId: 'txn_charge_bt',
    })
  })

  it('throws when the order row has no PaymentIntent id', async () => {
    mockSupabaseFrom.mockReturnValueOnce(
      chain({ data: { stripe_payment_intent_id: null, total_cents: 1100 } })
    )

    await expect(
      assertOrderSettled(ORDER_ID, { pollIntervalMs: 10, timeoutMs: 50 })
    ).rejects.toThrow(/order .* not paid/i)
  })

  it('throws when PaymentIntent status is not succeeded', async () => {
    mockSupabaseFrom
      .mockReturnValueOnce(chain({ data: { stripe_payment_intent_id: PI_ID, total_cents: 1100 } }))
      .mockReturnValueOnce(chain({ data: { amount_cents: 1100, platform_fee_cents: 110 } }))

    mockPaymentIntentsRetrieve.mockResolvedValue({
      id: PI_ID,
      status: 'requires_payment_method',
      amount_received: 0,
      latest_charge: null,
    })

    await expect(
      assertOrderSettled(ORDER_ID, { pollIntervalMs: 10, timeoutMs: 50 })
    ).rejects.toThrow(/PI not succeeded/i)
  })

  it('throws when no transfer arrives within the timeout', async () => {
    mockSupabaseFrom
      .mockReturnValueOnce(chain({ data: { stripe_payment_intent_id: PI_ID, total_cents: 1100 } }))
      .mockReturnValueOnce(chain({ data: { amount_cents: 1100, platform_fee_cents: 110 } }))

    mockPaymentIntentsRetrieve.mockResolvedValue({
      id: PI_ID,
      status: 'succeeded',
      amount_received: 1100,
      latest_charge: {
        id: CHARGE_ID,
        paid: true,
        captured: true,
        balance_transaction: 'txn_charge_bt',
      },
    })

    // No matching transfer ever returned
    mockTransfersList.mockResolvedValue({ data: [] })

    await expect(
      assertOrderSettled(ORDER_ID, { pollIntervalMs: 10, timeoutMs: 50 })
    ).rejects.toThrow(/no transfer for charge/i)
  })

  it('throws when transfer.source_transaction does not match the charge id', async () => {
    mockSupabaseFrom
      .mockReturnValueOnce(chain({ data: { stripe_payment_intent_id: PI_ID, total_cents: 1100 } }))
      .mockReturnValueOnce(chain({ data: { amount_cents: 1100, platform_fee_cents: 110 } }))

    mockPaymentIntentsRetrieve.mockResolvedValue({
      id: PI_ID,
      status: 'succeeded',
      amount_received: 1100,
      latest_charge: {
        id: CHARGE_ID,
        paid: true,
        captured: true,
        balance_transaction: 'txn_charge_bt',
      },
    })

    mockTransfersList.mockResolvedValue({
      data: [
        {
          id: TRANSFER_ID,
          amount: 990,
          source_transaction: 'ch_OTHER',
          metadata: { order_id: ORDER_ID },
        },
      ],
    })

    await expect(
      assertOrderSettled(ORDER_ID, { pollIntervalMs: 10, timeoutMs: 100 })
    ).rejects.toThrow(/source_transaction/i)
  })

  it('throws when the platform fee math does not equal 10%', async () => {
    mockSupabaseFrom
      .mockReturnValueOnce(chain({ data: { stripe_payment_intent_id: PI_ID, total_cents: 1100 } }))
      .mockReturnValueOnce(chain({ data: { amount_cents: 1100, platform_fee_cents: 110 } }))

    mockPaymentIntentsRetrieve.mockResolvedValue({
      id: PI_ID,
      status: 'succeeded',
      amount_received: 1100,
      latest_charge: {
        id: CHARGE_ID,
        paid: true,
        captured: true,
        balance_transaction: 'txn_charge_bt',
      },
    })

    // Transfer amount is wrong: should be 990 (=1100-110), but here it's 800
    mockTransfersList.mockResolvedValue({
      data: [
        {
          id: TRANSFER_ID,
          amount: 800,
          source_transaction: CHARGE_ID,
          metadata: { order_id: ORDER_ID },
        },
      ],
    })

    await expect(
      assertOrderSettled(ORDER_ID, { pollIntervalMs: 10, timeoutMs: 100 })
    ).rejects.toThrow(/transfer amount/i)
  })

  it('throws when latest_charge is null on the PaymentIntent', async () => {
    mockSupabaseFrom
      .mockReturnValueOnce(chain({ data: { stripe_payment_intent_id: PI_ID, total_cents: 1100 } }))
      .mockReturnValueOnce(chain({ data: { amount_cents: 1100, platform_fee_cents: 110 } }))

    mockPaymentIntentsRetrieve.mockResolvedValue({
      id: PI_ID,
      status: 'succeeded',
      amount_received: 1100,
      latest_charge: null,
    })

    await expect(
      assertOrderSettled(ORDER_ID, { pollIntervalMs: 10, timeoutMs: 50 })
    ).rejects.toThrow(/latest_charge/i)
  })
})
