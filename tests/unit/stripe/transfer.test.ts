/**
 * @file transfer.test.ts
 * @description Unit tests for transferToSwiper: fee math, Stripe-failure
 *   persistence to transfer_failures, no-op on already-transferred, and the
 *   regression guard that the removed `status: 'paid'` UPDATE is gone.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { stripeTransfers, mockServiceFrom } = vi.hoisted(() => ({
  stripeTransfers: { create: vi.fn() },
  mockServiceFrom: vi.fn(),
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripe: () => ({ transfers: stripeTransfers }),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockServiceFrom }),
}))

import { transferToSwiper } from '@/lib/stripe/transfer'

type DbResult = { data?: unknown; error?: unknown }

interface MockChain {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  then: (resolve: (v: DbResult) => void) => Promise<unknown>
}

function dbResult(result: DbResult = { data: null, error: null }): MockChain {
  const chain = {} as Partial<MockChain>
  const methods: (keyof MockChain)[] = ['select', 'insert', 'update', 'eq', 'is']
  for (const method of methods) {
    ;(chain as Record<string, unknown>)[method] = vi.fn(() => chain)
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve(result))
  chain.single = vi.fn(() => Promise.resolve(result))
  chain.then = (resolve: (v: DbResult) => void) => Promise.resolve(result).then(resolve)
  return chain as MockChain
}

beforeEach(() => {
  vi.clearAllMocks()
  stripeTransfers.create.mockReset()
})

describe('transferToSwiper', () => {
  const ORDER_ID = '00000000-0000-4000-8000-000000000001'
  const SWIPER_ID = '00000000-0000-4000-8000-000000000002'

  function setupHappy(opts: { payeeIdAlreadySet?: boolean } = {}) {
    const paymentsRead = dbResult({
      data: { id: 'pay-1', payee_id: opts.payeeIdAlreadySet ? SWIPER_ID : null },
    })
    const stripeAccountsRead = dbResult({ data: { stripe_account_id: 'acct_1' } })
    const paymentsUpdate = dbResult()

    mockServiceFrom.mockImplementation((table: string): MockChain => {
      if (table === 'payments') {
        // First call: select. Second call: update.
        return paymentsRead.maybeSingle.mock.calls.length === 0
          ? paymentsRead
          : paymentsUpdate
      }
      if (table === 'stripe_accounts') return stripeAccountsRead
      return dbResult()
    })

    return { paymentsRead, stripeAccountsRead, paymentsUpdate }
  }

  it('transfers total minus 10% fee when Stripe succeeds', async () => {
    const mocks = setupHappy()
    stripeTransfers.create.mockResolvedValue({ id: 'tr_1' })

    await transferToSwiper(ORDER_ID, SWIPER_ID, 2000)

    expect(stripeTransfers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1800,
        currency: 'usd',
        destination: 'acct_1',
      }),
      expect.objectContaining({ idempotencyKey: `transfer-${ORDER_ID}` })
    )
    expect(mocks.paymentsUpdate.update).toHaveBeenCalledWith({ payee_id: SWIPER_ID })
  })

  it('does not UPDATE orders.status to "paid" (regression guard for finding #5)', async () => {
    setupHappy()
    stripeTransfers.create.mockResolvedValue({ id: 'tr_2' })

    await transferToSwiper(ORDER_ID, SWIPER_ID, 1000)

    const orderCalls = mockServiceFrom.mock.calls.filter(
      (args: unknown[]) => args[0] === 'orders'
    )
    expect(orderCalls).toHaveLength(0)
  })

  it('is a no-op when payee_id is already set (already transferred)', async () => {
    setupHappy({ payeeIdAlreadySet: true })
    await transferToSwiper(ORDER_ID, SWIPER_ID, 1000)
    expect(stripeTransfers.create).not.toHaveBeenCalled()
  })

  it('is a no-op when no succeeded payment exists', async () => {
    mockServiceFrom.mockImplementation((table: string): MockChain => {
      if (table === 'payments') return dbResult({ data: null })
      return dbResult()
    })
    await transferToSwiper(ORDER_ID, SWIPER_ID, 1000)
    expect(stripeTransfers.create).not.toHaveBeenCalled()
  })

  it('records a transfer_failures row when the swiper has no Stripe account', async () => {
    const transferFailuresInsert = dbResult()
    mockServiceFrom.mockImplementation((table: string): MockChain => {
      if (table === 'payments') return dbResult({ data: { id: 'pay-1', payee_id: null } })
      if (table === 'stripe_accounts') return dbResult({ data: null })
      if (table === 'transfer_failures') return transferFailuresInsert
      return dbResult()
    })

    await transferToSwiper(ORDER_ID, SWIPER_ID, 1000)

    expect(stripeTransfers.create).not.toHaveBeenCalled()
    expect(transferFailuresInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: ORDER_ID,
        stripe_error_code: 'no_connected_account',
      })
    )
  })

  it('records a transfer_failures row on Stripe error (finding #11)', async () => {
    const transferFailuresInsert = dbResult()
    mockServiceFrom.mockImplementation((table: string): MockChain => {
      if (table === 'payments') return dbResult({ data: { id: 'pay-1', payee_id: null } })
      if (table === 'stripe_accounts') return dbResult({ data: { stripe_account_id: 'acct_1' } })
      if (table === 'transfer_failures') return transferFailuresInsert
      return dbResult()
    })

    const stripeError = Object.assign(new Error('Insufficient funds'), { code: 'balance_insufficient' })
    stripeTransfers.create.mockRejectedValue(stripeError)

    await transferToSwiper(ORDER_ID, SWIPER_ID, 2000)

    expect(transferFailuresInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: ORDER_ID,
        stripe_error_code: 'balance_insufficient',
        stripe_error_message: 'Insufficient funds',
      })
    )
  })

  it('does NOT mark payee_id when transfer fails', async () => {
    const paymentsUpdate = dbResult()
    let paymentsSelectCalled = false
    mockServiceFrom.mockImplementation((table: string): MockChain => {
      if (table === 'payments') {
        if (!paymentsSelectCalled) {
          paymentsSelectCalled = true
          return dbResult({ data: { id: 'pay-1', payee_id: null } })
        }
        return paymentsUpdate
      }
      if (table === 'stripe_accounts') return dbResult({ data: { stripe_account_id: 'acct_1' } })
      if (table === 'transfer_failures') return dbResult()
      return dbResult()
    })

    stripeTransfers.create.mockRejectedValue(new Error('boom'))
    await transferToSwiper(ORDER_ID, SWIPER_ID, 1000)

    expect(paymentsUpdate.update).not.toHaveBeenCalled()
  })
})
