/**
 * @file capture-and-transfer.test.ts
 * @description Unit tests for captureAndTransfer — the manual-capture
 *   replacement for transferToSwiper. Verifies capture/transfer ordering,
 *   idempotency keys, the capture-fail branch (blocks completion), the
 *   transfer-stuck branch (still completes), and side-effects on
 *   payments.capture_failed_at / transfer_failed_at / status / payee_id.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// capture-and-transfer.ts imports `server-only`, which throws under jsdom.
vi.mock('server-only', () => ({}))

const { mockServiceFrom, mockTransfersCreate, mockPaymentIntentsCapture } = vi.hoisted(() => ({
  mockServiceFrom: vi.fn(),
  mockTransfersCreate: vi.fn(),
  mockPaymentIntentsCapture: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom })),
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripe: vi.fn(() => ({
    transfers: { create: mockTransfersCreate },
    paymentIntents: { capture: mockPaymentIntentsCapture },
  })),
}))

import { captureAndTransfer } from '@/lib/stripe/capture-and-transfer'

const ORDER_ID = '00000000-0000-4000-8000-000000000100'
const SWIPER_ID = '00000000-0000-4000-8000-000000000001'
const PI_ID = 'pi_test_123'

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

function pendingPayment() {
  return {
    id: 'pay-1',
    status: 'pending',
    payee_id: null,
    amount_cents: 2000,
    platform_fee_cents: 200,
    stripe_payment_intent_id: PI_ID,
  }
}

function capturedPayment() {
  return { ...pendingPayment(), status: 'succeeded' }
}

function transferredPayment() {
  return { ...capturedPayment(), payee_id: SWIPER_ID }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockTransfersCreate.mockResolvedValue({ id: 'tr_test_1' })
  mockPaymentIntentsCapture.mockResolvedValue({ id: PI_ID, status: 'succeeded' })
})

describe('captureAndTransfer', () => {
  describe('happy path: capture + transfer both succeed', () => {
    it('captures the PI with the correct idempotency key, then transfers the net', async () => {
      // 1. payments.select (lookup)
      // 2. payments.update (status='succeeded' after capture)
      // 3. stripe_accounts.select
      // 4. payments.update (payee_id=swiperId after transfer)
      mockServiceFrom
        .mockReturnValueOnce(chain({ data: pendingPayment() }))
        .mockReturnValueOnce(chain({ data: null, error: null }))
        .mockReturnValueOnce(chain({ data: { stripe_account_id: 'acct_swiper' } }))
        .mockReturnValueOnce(chain({ data: null, error: null }))

      const result = await captureAndTransfer(ORDER_ID, SWIPER_ID)
      expect(result).toEqual({ ok: true })

      expect(mockPaymentIntentsCapture).toHaveBeenCalledWith(
        PI_ID,
        {},
        expect.objectContaining({ idempotencyKey: `capture-${ORDER_ID}` })
      )
      expect(mockTransfersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1800,
          currency: 'usd',
          destination: 'acct_swiper',
          metadata: { order_id: ORDER_ID },
        }),
        expect.objectContaining({ idempotencyKey: `transfer-${ORDER_ID}` })
      )
    })
  })

  describe('capture branch', () => {
    it('returns ok=false reason=capture_failed and writes capture_failed_at when paymentIntents.capture rejects', async () => {
      const failureUpdate = chain({ data: null, error: null })
      mockServiceFrom
        .mockReturnValueOnce(chain({ data: pendingPayment() }))
        .mockReturnValueOnce(failureUpdate)

      mockPaymentIntentsCapture.mockRejectedValueOnce(new Error('auth expired'))

      const result = await captureAndTransfer(ORDER_ID, SWIPER_ID)
      expect(result).toEqual({ ok: false, reason: 'capture_failed' })

      expect(failureUpdate.update).toHaveBeenCalledWith(
        expect.objectContaining({ capture_failed_at: expect.any(String) })
      )
      expect(mockTransfersCreate).not.toHaveBeenCalled()
    })

    it('skips capture when payment.status is already succeeded (idempotent retry)', async () => {
      mockServiceFrom
        .mockReturnValueOnce(chain({ data: capturedPayment() }))
        .mockReturnValueOnce(chain({ data: { stripe_account_id: 'acct_swiper' } }))
        .mockReturnValueOnce(chain({ data: null, error: null }))

      const result = await captureAndTransfer(ORDER_ID, SWIPER_ID)
      expect(result).toEqual({ ok: true })

      expect(mockPaymentIntentsCapture).not.toHaveBeenCalled()
      expect(mockTransfersCreate).toHaveBeenCalledTimes(1)
    })

    it('returns capture_failed without calling Stripe when payment.status is unexpected (defense-in-depth)', async () => {
      mockServiceFrom.mockReturnValueOnce(
        chain({ data: { ...pendingPayment(), status: 'refunded' } })
      )
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await captureAndTransfer(ORDER_ID, SWIPER_ID)
      expect(result).toEqual({ ok: false, reason: 'capture_failed' })
      expect(mockPaymentIntentsCapture).not.toHaveBeenCalled()
      expect(mockTransfersCreate).not.toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`unexpected payment.status='refunded' for order ${ORDER_ID}`)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('transfer branch', () => {
    it('returns ok=true transferStuck=true and writes transfer_failed_at when transfers.create rejects', async () => {
      const transferFailUpdate = chain({ data: null, error: null })
      mockServiceFrom
        .mockReturnValueOnce(chain({ data: pendingPayment() }))
        .mockReturnValueOnce(chain({ data: null, error: null })) // post-capture status update
        .mockReturnValueOnce(chain({ data: { stripe_account_id: 'acct_swiper' } }))
        .mockReturnValueOnce(transferFailUpdate)

      mockTransfersCreate.mockRejectedValueOnce(new Error('account_invalid'))

      const result = await captureAndTransfer(ORDER_ID, SWIPER_ID)
      expect(result).toEqual({ ok: true, transferStuck: true })

      expect(transferFailUpdate.update).toHaveBeenCalledWith(
        expect.objectContaining({ transfer_failed_at: expect.any(String) })
      )
    })

    it('returns ok=true transferStuck=true when no Stripe account exists for the swiper (post-capture)', async () => {
      const transferFailUpdate = chain({ data: null, error: null })
      mockServiceFrom
        .mockReturnValueOnce(chain({ data: pendingPayment() }))
        .mockReturnValueOnce(chain({ data: null, error: null })) // post-capture status update
        .mockReturnValueOnce(chain({ data: null })) // stripe_accounts lookup misses
        .mockReturnValueOnce(transferFailUpdate)

      const result = await captureAndTransfer(ORDER_ID, SWIPER_ID)
      expect(result).toEqual({ ok: true, transferStuck: true })

      expect(mockTransfersCreate).not.toHaveBeenCalled()
      expect(transferFailUpdate.update).toHaveBeenCalledWith(
        expect.objectContaining({ transfer_failed_at: expect.any(String) })
      )
    })

    it('skips transfer when payee_id is already set (idempotent retry on completed transfer)', async () => {
      mockServiceFrom.mockReturnValueOnce(chain({ data: transferredPayment() }))

      const result = await captureAndTransfer(ORDER_ID, SWIPER_ID)
      expect(result).toEqual({ ok: true })

      expect(mockPaymentIntentsCapture).not.toHaveBeenCalled()
      expect(mockTransfersCreate).not.toHaveBeenCalled()
    })
  })

  describe('no payment record', () => {
    it('returns ok=false reason=no_payment when payments.select returns null', async () => {
      mockServiceFrom.mockReturnValueOnce(chain({ data: null }))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await captureAndTransfer(ORDER_ID, SWIPER_ID)
      expect(result).toEqual({ ok: false, reason: 'no_payment' })

      expect(mockPaymentIntentsCapture).not.toHaveBeenCalled()
      expect(mockTransfersCreate).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('returns ok=false reason=no_payment when stripe_payment_intent_id is null', async () => {
      mockServiceFrom.mockReturnValueOnce(
        chain({ data: { ...pendingPayment(), stripe_payment_intent_id: null } })
      )
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await captureAndTransfer(ORDER_ID, SWIPER_ID)
      expect(result).toEqual({ ok: false, reason: 'no_payment' })
      consoleSpy.mockRestore()
    })
  })

  describe('correct fee math', () => {
    it('transfers amount_cents - platform_fee_cents (60% of subtotal minus 10% platform fee = 50% to swiper)', async () => {
      // Subtotal $25 → orderer pays $15 (1500), platform $2.50 (250), swiper $12.50 (1250)
      const payment = {
        id: 'pay-1',
        status: 'pending',
        payee_id: null,
        amount_cents: 1500,
        platform_fee_cents: 250,
        stripe_payment_intent_id: PI_ID,
      }
      mockServiceFrom
        .mockReturnValueOnce(chain({ data: payment }))
        .mockReturnValueOnce(chain({ data: null, error: null }))
        .mockReturnValueOnce(chain({ data: { stripe_account_id: 'acct_swiper' } }))
        .mockReturnValueOnce(chain({ data: null, error: null }))

      await captureAndTransfer(ORDER_ID, SWIPER_ID)

      expect(mockTransfersCreate).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1250 }),
        expect.anything()
      )
    })
  })
})
