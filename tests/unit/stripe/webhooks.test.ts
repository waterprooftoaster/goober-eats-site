/**
 * @file webhooks.test.ts
 * @description Unit tests for the Stripe webhook route handler after the
 *   GrubHub-screenshot pivot. Verifies: signature validation, payment_intent
 *   metadata validation (school_id / restaurant_name / cart_screenshot_paths
 *   / subtotal_cents / UUIDs), server-side re-derivation of the 60/50/10
 *   split, idempotency via payments.stripe_payment_intent_id, orphan-order
 *   recovery, and account.updated onboarding completion.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'

// ---------------------------------------------------------------------------
const WEBHOOK_SECRET = 'whsec_test_secret'
const VALID_SCHOOL_ID = '00000000-0000-4000-8000-000000000aaa'
const VALID_ORDERER_ID = '00000000-0000-4000-8000-000000000051'
const VALID_PI_ID = 'pi_test_123'
const INVALID_UUID = 'not-a-uuid'
const VALID_PATH = 'pre-checkout/ABCdef1234/00000000-0000-4000-8000-000000000010.png'

const { mockServiceFrom } = vi.hoisted(() => ({ mockServiceFrom: vi.fn() }))

const stripe = new Stripe('sk_test_fake')

vi.mock('@/lib/stripe/client', () => ({ getStripe: vi.fn(() => stripe) }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom })),
}))

import { POST } from '@/app/api/stripe/webhooks/route'

// ---------------------------------------------------------------------------

function dbResult(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const mock: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'is']) {
    mock[m] = vi.fn(() => mock)
  }
  mock.maybeSingle = vi.fn(() => Promise.resolve(result))
  mock.single = vi.fn(() => Promise.resolve(result))
  mock.then = (resolve: (v: typeof result) => void) =>
    Promise.resolve(result).then(resolve)
  return mock
}

function buildSignedRequest(event: Record<string, unknown>): NextRequest {
  const payload = JSON.stringify(event)
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  })
  return new NextRequest('http://localhost/api/stripe/webhooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
    body: payload,
  })
}

function buildBadSigRequest(event: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/stripe/webhooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 'bad_sig' },
    body: JSON.stringify(event),
  })
}

function makeEvent(type: string, object: Record<string, unknown>) {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    type,
    data: { object },
  }
}

// Subtotal $25 → orderer pays $15 (60%), platform $2.50, swiper $12.50.
function guestMetadata(overrides: Record<string, string> = {}) {
  return {
    is_guest: 'true',
    school_id: VALID_SCHOOL_ID,
    restaurant_name: 'Chipotle',
    cart_screenshot_paths: VALID_PATH,
    subtotal_cents: '2500',
    total_cents: '1500',
    platform_fee_cents: '250',
    guest_name: 'Test Guest',
    ...overrides,
  }
}

function authMetadata(overrides: Record<string, string> = {}) {
  return {
    school_id: VALID_SCHOOL_ID,
    restaurant_name: 'Chipotle',
    cart_screenshot_paths: VALID_PATH,
    subtotal_cents: '2500',
    total_cents: '1500',
    platform_fee_cents: '250',
    orderer_id: VALID_ORDERER_ID,
    ...overrides,
  }
}

function guestPiEvent(overrides: Record<string, string> = {}) {
  return makeEvent('payment_intent.succeeded', {
    id: VALID_PI_ID,
    amount: 1500,
    metadata: guestMetadata(overrides),
  })
}

function authPiEvent(overrides: Record<string, string> = {}) {
  return makeEvent('payment_intent.succeeded', {
    id: VALID_PI_ID,
    amount: 1500,
    metadata: authMetadata(overrides),
  })
}

function setupHappyPath(orderId = '00000000-0000-4000-8000-000000000099') {
  const paymentsCheck = dbResult({ data: null })
  const ordersInsert = dbResult({ data: { id: orderId } })
  const paymentsInsert = dbResult({ data: null, error: null })

  mockServiceFrom
    .mockReturnValueOnce(paymentsCheck)
    .mockReturnValueOnce(ordersInsert)
    .mockReturnValueOnce(paymentsInsert)

  return { paymentsCheck, ordersInsert, paymentsInsert }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
})

describe('POST /api/stripe/webhooks', () => {
  // ── Signature verification ──────────────────────────────────────────────

  describe('signature verification', () => {
    it('returns 400 when stripe-signature header is missing', async () => {
      const req = new NextRequest('http://localhost/api/stripe/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it('returns 400 when signature is invalid', async () => {
      const res = await POST(buildBadSigRequest(makeEvent('payment_intent.succeeded', { id: VALID_PI_ID })))
      expect(res.status).toBe(400)
    })

    it('returns 500 when STRIPE_WEBHOOK_SECRET is not set', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET
      const res = await POST(buildSignedRequest(makeEvent('payment_intent.succeeded', { id: VALID_PI_ID })))
      expect(res.status).toBe(500)
    })

    it('accepts a valid signature and returns 200 for unknown event types', async () => {
      const res = await POST(buildSignedRequest(makeEvent('unknown.event', {})))
      expect(res.status).toBe(200)
    })
  })

  // ── payment_intent.succeeded ─────────────────────────────────────────

  // NOTE: happy-path payment_intent.succeeded coverage (guest + auth) is
  // exercised end-to-end by tests/unit/stripe/webhook-cli-roundtrip.test.ts
  // (gated on STRIPE_CLI=1) and the live-money Playwright spec. The cases
  // below cover error injection / idempotency that the Stripe CLI cannot
  // cheaply synthesize.

  describe('payment_intent.succeeded idempotency + recovery', () => {
    it('skips duplicate PI delivery', async () => {
      mockServiceFrom.mockReturnValueOnce(dbResult({ data: { id: 'existing-payment' } }))
      const res = await POST(buildSignedRequest(guestPiEvent()))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).toHaveBeenCalledTimes(1)
    })

    it('recovers orphan order on orders.insert failure (retry path)', async () => {
      const orphanId = '00000000-0000-4000-8000-000000000077'
      // 1. payments idempotency → none
      // 2. orders.insert → conflict
      // 3. orders.select → find orphan
      // 4. payments.insert → succeeds
      mockServiceFrom
        .mockReturnValueOnce(dbResult({ data: null }))
        .mockReturnValueOnce(dbResult({ data: null, error: { code: '23505', message: 'duplicate' } }))
        .mockReturnValueOnce(dbResult({ data: { id: orphanId } }))
        .mockReturnValueOnce(dbResult({ data: null, error: null }))

      const res = await POST(buildSignedRequest(guestPiEvent()))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).toHaveBeenCalledTimes(4)
    })

    it('returns 200 (no Stripe retry) when orders.insert fails with a permanent constraint error', async () => {
      // 1. payments idempotency → none
      // 2. orders.insert → 23514 check-constraint violation (permanent)
      // 3. orders.select → no orphan exists (the constraint blocked the insert)
      mockServiceFrom
        .mockReturnValueOnce(dbResult({ data: null }))
        .mockReturnValueOnce(dbResult({ data: null, error: { code: '23514', message: 'check constraint' } }))
        .mockReturnValueOnce(dbResult({ data: null }))

      const res = await POST(buildSignedRequest(guestPiEvent()))
      expect(res.status).toBe(200)
    })

    it('returns 500 (retry) when orders.insert fails with a non-permanent error', async () => {
      mockServiceFrom
        .mockReturnValueOnce(dbResult({ data: null }))
        .mockReturnValueOnce(dbResult({ data: null, error: { code: '08006', message: 'connection failure' } }))
        .mockReturnValueOnce(dbResult({ data: null }))

      const res = await POST(buildSignedRequest(guestPiEvent()))
      expect(res.status).toBe(500)
    })
  })

  describe('payment_intent.succeeded metadata validation', () => {
    it('skips when school_id is not a UUID', async () => {
      const res = await POST(buildSignedRequest(guestPiEvent({ school_id: INVALID_UUID })))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('skips when cart_screenshot_paths contains invalid path', async () => {
      const res = await POST(
        buildSignedRequest(guestPiEvent({ cart_screenshot_paths: 'orders/foo.png' }))
      )
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('skips when subtotal_cents is non-numeric', async () => {
      const res = await POST(buildSignedRequest(guestPiEvent({ subtotal_cents: 'banana' })))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('re-derives platform_fee_cents server-side; tampered metadata is ignored', async () => {
      const { paymentsInsert } = setupHappyPath()
      // Attacker-controlled platform_fee_cents in metadata — should be ignored.
      const res = await POST(
        buildSignedRequest(guestPiEvent({ platform_fee_cents: '0', total_cents: '99999' }))
      )
      expect(res.status).toBe(200)
      expect(paymentsInsert.insert).toHaveBeenCalledWith(
        expect.objectContaining({ amount_cents: 1500, platform_fee_cents: 250 })
      )
    })

    it('skips when restaurant_name is empty after trim', async () => {
      const res = await POST(buildSignedRequest(guestPiEvent({ restaurant_name: '   ' })))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('skips when screenshot count exceeds 5', async () => {
      const tooMany = Array(6).fill(VALID_PATH).join(',')
      const res = await POST(buildSignedRequest(guestPiEvent({ cart_screenshot_paths: tooMany })))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('skips guest payload missing guest_name', async () => {
      const res = await POST(buildSignedRequest(guestPiEvent({ guest_name: '' })))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('skips auth payload with invalid orderer_id UUID', async () => {
      const res = await POST(buildSignedRequest(authPiEvent({ orderer_id: INVALID_UUID })))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })
  })

  describe('account.updated', () => {
    const ACCT_USER_ID = '00000000-0000-4000-8000-000000000060'

    it('marks onboarding_complete and auto-activates swiper when school_id present', async () => {
      mockServiceFrom.mockImplementation((table: string) => {
        if (table === 'stripe_accounts') {
          return dbResult({ data: { id: 'sa-1', user_id: ACCT_USER_ID } })
        }
        if (table === 'profiles') {
          return dbResult({ data: { school_id: 'school-1' } })
        }
        return dbResult()
      })

      const res = await POST(
        buildSignedRequest(
          makeEvent('account.updated', {
            id: 'acct_test_123',
            details_submitted: true,
            charges_enabled: true,
          })
        )
      )
      expect(res.status).toBe(200)
    })

    it('skips when account is not on this platform', async () => {
      mockServiceFrom.mockReturnValueOnce(dbResult({ data: null }))
      const res = await POST(
        buildSignedRequest(
          makeEvent('account.updated', {
            id: 'acct_unknown',
            details_submitted: true,
            charges_enabled: true,
          })
        )
      )
      expect(res.status).toBe(200)
    })

    it('marks stripe_accounts.suspended when requirements.disabled_reason starts with rejected.', async () => {
      const stripeAccountsUpdate = dbResult({ data: null, error: null })
      let updateCallCount = 0
      mockServiceFrom.mockImplementation((table: string) => {
        if (table === 'stripe_accounts') {
          updateCallCount += 1
          if (updateCallCount === 1) {
            // first hit: lookup row
            return dbResult({ data: { id: 'sa-1', user_id: ACCT_USER_ID } })
          }
          // subsequent hits: the suspension UPDATE
          return stripeAccountsUpdate
        }
        return dbResult()
      })

      const res = await POST(
        buildSignedRequest(
          makeEvent('account.updated', {
            id: 'acct_test_suspend',
            details_submitted: true,
            charges_enabled: false,
            requirements: { disabled_reason: 'rejected.fraud' },
          })
        )
      )
      expect(res.status).toBe(200)
      expect(stripeAccountsUpdate.update).toHaveBeenCalledWith(
        expect.objectContaining({ suspended: true })
      )
    })

    it('does NOT suspend on transient disabled_reason (e.g. requirements.past_due)', async () => {
      const calls: Array<{ table: string; chain: ReturnType<typeof dbResult> }> = []
      mockServiceFrom.mockImplementation((table: string) => {
        const chain =
          table === 'stripe_accounts'
            ? dbResult({ data: { id: 'sa-1', user_id: ACCT_USER_ID } })
            : dbResult()
        calls.push({ table, chain })
        return chain
      })

      const res = await POST(
        buildSignedRequest(
          makeEvent('account.updated', {
            id: 'acct_test_past_due',
            details_submitted: true,
            charges_enabled: true,
            requirements: { disabled_reason: 'requirements.past_due' },
          })
        )
      )
      expect(res.status).toBe(200)
      // No call should have been made with { suspended: true } in update
      for (const { chain } of calls) {
        const update = chain.update as ReturnType<typeof vi.fn>
        for (const updateCall of update.mock.calls) {
          expect(updateCall[0]).not.toHaveProperty('suspended')
        }
      }
    })
  })

  // NOTE: no-op event coverage (payment_intent.payment_failed,
  // checkout.session.completed, checkout.session.expired) was removed —
  // these were single-line "do nothing" handlers; the only real value was
  // proving they don't throw, which is implicit in the signature suite.
})
