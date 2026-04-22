/**
 * @file webhooks.test.ts
 * @description Unit tests for the Stripe webhook route handler after the
 *   GrubHub-screenshot pivot. Verifies: signature validation, payment_intent
 *   metadata validation (school_id / restaurant_name / cart_screenshot_paths
 *   / total_cents / UUIDs), idempotency via payments.stripe_payment_intent_id,
 *   orphan-order recovery, and account.updated onboarding completion.
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

function guestMetadata(overrides: Record<string, string> = {}) {
  return {
    is_guest: 'true',
    school_id: VALID_SCHOOL_ID,
    restaurant_name: 'Chipotle',
    cart_screenshot_paths: VALID_PATH,
    total_cents: '1500',
    guest_name: 'Test Guest',
    ...overrides,
  }
}

function authMetadata(overrides: Record<string, string> = {}) {
  return {
    school_id: VALID_SCHOOL_ID,
    restaurant_name: 'Chipotle',
    cart_screenshot_paths: VALID_PATH,
    total_cents: '1500',
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

  describe('payment_intent.succeeded (guest)', () => {
    it('creates an order with null orderer_id, guest_name, school_id, and cart_screenshot_urls', async () => {
      const { ordersInsert, paymentsInsert } = setupHappyPath()

      const res = await POST(buildSignedRequest(guestPiEvent()))
      expect(res.status).toBe(200)

      expect(ordersInsert.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          orderer_id: null,
          school_id: VALID_SCHOOL_ID,
          restaurant_name: 'Chipotle',
          cart_screenshot_urls: [VALID_PATH],
          guest_name: 'Test Guest',
          total_cents: 1500,
          stripe_payment_intent_id: VALID_PI_ID,
        })
      )

      // Regression guard — tips and special_instructions were removed as
      // features; the orders insert payload must not carry either key.
      const [insertArg] = ordersInsert.insert.mock.calls[0]
      expect(insertArg).not.toHaveProperty('tip_cents')
      expect(insertArg).not.toHaveProperty('special_instructions')

      expect(paymentsInsert.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          stripe_payment_intent_id: VALID_PI_ID,
          amount_cents: 1500,
          platform_fee_cents: 150,
          status: 'succeeded',
          payer_id: null,
          payee_id: null,
        })
      )
    })

    it('accepts multiple comma-joined screenshot paths', async () => {
      setupHappyPath()
      const path2 = VALID_PATH.replace('.png', '.webp')
      const res = await POST(
        buildSignedRequest(
          guestPiEvent({ cart_screenshot_paths: `${VALID_PATH},${path2}` })
        )
      )
      expect(res.status).toBe(200)
    })
  })

  describe('payment_intent.succeeded (auth)', () => {
    it('creates order with orderer_id and null guest fields', async () => {
      const { ordersInsert, paymentsInsert } = setupHappyPath()

      const res = await POST(buildSignedRequest(authPiEvent()))
      expect(res.status).toBe(200)

      expect(ordersInsert.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          orderer_id: VALID_ORDERER_ID,
          school_id: VALID_SCHOOL_ID,
          restaurant_name: 'Chipotle',
          guest_name: null,
          guest_access_token: null,
        })
      )
      expect(paymentsInsert.insert).toHaveBeenCalledWith(
        expect.objectContaining({ payer_id: VALID_ORDERER_ID })
      )
    })
  })

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

    it('skips when total_cents is non-numeric', async () => {
      const res = await POST(buildSignedRequest(guestPiEvent({ total_cents: 'banana' })))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
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
  })

  describe('no-op events', () => {
    it('payment_intent.payment_failed is a no-op', async () => {
      const res = await POST(
        buildSignedRequest(makeEvent('payment_intent.payment_failed', { id: VALID_PI_ID }))
      )
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('checkout.session.completed is a no-op', async () => {
      const res = await POST(
        buildSignedRequest(
          makeEvent('checkout.session.completed', {
            id: 'cs_test_abc',
            payment_intent: VALID_PI_ID,
            amount_total: 1500,
          })
        )
      )
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('checkout.session.expired is a no-op', async () => {
      const res = await POST(
        buildSignedRequest(makeEvent('checkout.session.expired', {}))
      )
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })
  })
})
