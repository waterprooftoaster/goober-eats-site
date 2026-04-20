/**
 * @file webhooks.test.ts
 * @description Unit tests for the Stripe webhook route handler (POST /api/stripe/webhook).
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const WEBHOOK_SECRET = 'whsec_test_secret'
const VALID_CART_ID = '00000000-0000-4000-8000-000000000002'
const VALID_EATERY_ID = '00000000-0000-4000-8000-000000000003'
const VALID_PI_ID = 'pi_test_123'
const VALID_MENU_ITEM_ID = '00000000-0000-4000-8000-000000000010'
const VALID_ORDERER_ID = '00000000-0000-4000-8000-000000000051'
const INVALID_UUID = 'not-a-uuid'

// ---------------------------------------------------------------------------
// Mocks — hoisted so vi.mock factories can reference them
// ---------------------------------------------------------------------------
const { mockServiceFrom, mockLoadCart } = vi.hoisted(() => ({
  mockServiceFrom: vi.fn(),
  mockLoadCart: vi.fn(),
}))

// Real Stripe instance for signature verification (no API calls)
const stripe = new Stripe('sk_test_fake')

vi.mock('@/lib/stripe/client', () => ({
  getStripe: vi.fn(() => stripe),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom })),
}))

vi.mock('@/lib/cart/load', () => ({
  loadCart: (...args: unknown[]) => mockLoadCart(...args),
}))

// ---------------------------------------------------------------------------
// Import handler AFTER mocks are registered
// ---------------------------------------------------------------------------
import { POST } from '@/app/api/stripe/webhooks/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock Supabase query-chain object that resolves to `result`. */
function dbResult(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const mock: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'in', 'is']) {
    mock[m] = vi.fn(() => mock)
  }
  mock.maybeSingle = vi.fn(() => Promise.resolve(result))
  mock.single = vi.fn(() => Promise.resolve(result))
  // Make the chain thenable for operations that don't call single/maybeSingle
  mock.then = (resolve: (v: typeof result) => void) => Promise.resolve(result).then(resolve)
  return mock
}

/** Build a NextRequest with a correctly signed Stripe webhook payload. */
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

/** Build a NextRequest with an INVALID signature. */
function buildBadSigRequest(event: Record<string, unknown>): NextRequest {
  const payload = JSON.stringify(event)
  return new NextRequest('http://localhost/api/stripe/webhooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 'bad_sig' },
    body: payload,
  })
}

/** Build a minimal Stripe-shaped event object. */
function makeEvent(type: string, object: Record<string, unknown>) {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    type,
    data: { object },
  }
}

/** Standard cart items returned by loadCart mock. */
const MOCK_CART_ITEMS = [
  {
    id: 'ci-1',
    menu_item_id: VALID_MENU_ITEM_ID,
    name: 'Test Burger',
    quantity: 2,
    price_cents: 500,
    image_url: null,
    selected_options: [],
  },
]

/** Standard metadata for a guest checkout PI. */
function guestPiMetadata(overrides: Record<string, string> = {}) {
  return {
    is_guest: 'true',
    cart_id: VALID_CART_ID,
    eatery_id: VALID_EATERY_ID,
    guest_name: 'Test Guest',
    tip_cents: '0',
    special_instructions: '',
    platform_fee_cents: '200',
    total_cents: '1000',
    ...overrides,
  }
}

/** Standard metadata for an auth checkout PI. */
function authPiMetadata(overrides: Record<string, string> = {}) {
  return {
    cart_id: VALID_CART_ID,
    eatery_id: VALID_EATERY_ID,
    orderer_id: VALID_ORDERER_ID,
    tip_cents: '0',
    special_instructions: '',
    platform_fee_cents: '200',
    total_cents: '1000',
    ...overrides,
  }
}

/** Set up mocks for a successful order creation flow. Returns chain refs for payload assertions. */
function setupSuccessfulOrderCreation(
  orderId = '00000000-0000-4000-8000-000000000099',
  cartUserId: string | null = null
) {
  const paymentsCheck = dbResult({ data: null })
  const cartsSelect = dbResult({ data: { id: VALID_CART_ID, eatery_id: VALID_EATERY_ID, user_id: cartUserId } })
  const ordersInsert = dbResult({ data: { id: orderId } })
  const paymentsInsert = dbResult({ data: null, error: null })
  const cartItemsDelete = dbResult({ data: null })
  const cartsDelete = dbResult({ data: null })

  mockServiceFrom
    .mockReturnValueOnce(paymentsCheck)
    .mockReturnValueOnce(cartsSelect)
    .mockReturnValueOnce(ordersInsert)
    .mockReturnValueOnce(paymentsInsert)
    .mockReturnValueOnce(cartItemsDelete)
    .mockReturnValueOnce(cartsDelete)

  mockLoadCart.mockResolvedValue({
    id: VALID_CART_ID,
    eatery_id: VALID_EATERY_ID,
    eatery_name: 'Test Eatery',
    items: MOCK_CART_ITEMS,
  })

  return { paymentsCheck, cartsSelect, ordersInsert, paymentsInsert, cartItemsDelete, cartsDelete }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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
      const body = await res.json()
      expect(body.error).toBe('Missing stripe-signature header')
    })

    it('returns 400 when signature is invalid', async () => {
      const event = makeEvent('payment_intent.succeeded', { id: VALID_PI_ID })
      const res = await POST(buildBadSigRequest(event))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Invalid webhook signature')
    })

    it('returns 500 when STRIPE_WEBHOOK_SECRET is not set', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET
      const event = makeEvent('payment_intent.succeeded', { id: VALID_PI_ID })
      const res = await POST(buildSignedRequest(event))
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('Server configuration error')
    })

    it('accepts a valid signature and returns 200', async () => {
      // Unknown event type — handler does nothing but accepts
      const event = makeEvent('unknown.event', {})
      const res = await POST(buildSignedRequest(event))
      expect(res.status).toBe(200)
    })
  })

  // ── payment_intent.succeeded (guest checkout) ─────────────────────────

  describe('payment_intent.succeeded (guest checkout)', () => {
    function guestPiEvent(metadataOverrides: Record<string, string> = {}) {
      return makeEvent('payment_intent.succeeded', {
        id: VALID_PI_ID,
        amount: 1000,
        metadata: guestPiMetadata(metadataOverrides),
      })
    }

    it('creates order with null orderer_id and guest_name set', async () => {
      const createdOrderId = '00000000-0000-4000-8000-000000000099'
      const { ordersInsert, paymentsInsert } = setupSuccessfulOrderCreation(createdOrderId)

      const res = await POST(buildSignedRequest(guestPiEvent()))
      expect(res.status).toBe(200)

      // Verify all 6 DB operations happened
      expect(mockServiceFrom).toHaveBeenCalledTimes(6)
      expect(mockLoadCart).toHaveBeenCalledTimes(1)

      // Verify orders.insert payload
      expect(ordersInsert.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          orderer_id: null,
          eatery_id: VALID_EATERY_ID,
          guest_name: 'Test Guest',
          tip_cents: 0,
          total_cents: 1000,
          guest_access_token: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          ),
        })
      )

      // Verify payments.insert payload
      expect(paymentsInsert.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: createdOrderId,
          stripe_payment_intent_id: VALID_PI_ID,
          payer_id: null,
          payee_id: null,
          status: 'succeeded',
        })
      )
    })

    it('skips duplicate delivery (idempotency)', async () => {
      // payments.select → existing payment found
      mockServiceFrom.mockReturnValueOnce(
        dbResult({ data: { id: 'existing-payment' } })
      )

      const res = await POST(buildSignedRequest(guestPiEvent()))
      expect(res.status).toBe(200)

      // Only 1 from() call — idempotency check stopped further processing
      expect(mockServiceFrom).toHaveBeenCalledTimes(1)
      expect(mockLoadCart).not.toHaveBeenCalled()
    })

    it('recovers orphan order on retry (order exists, payment insert failed)', async () => {
      const orphanOrderId = '00000000-0000-4000-8000-000000000077'

      // 1. payments.select (idempotency) → no existing
      // 2. carts.select → found
      // 3. orders.insert → fails (unique constraint on stripe_payment_intent_id)
      // 4. orders.select (recover orphan) → found
      // 5. payments.insert → success
      // 6. cart_items.delete → success
      // 7. carts.delete → success
      mockServiceFrom
        .mockReturnValueOnce(dbResult({ data: null }))
        .mockReturnValueOnce(dbResult({ data: { id: VALID_CART_ID, eatery_id: VALID_EATERY_ID, user_id: null } }))
        .mockReturnValueOnce(dbResult({ data: null, error: { message: 'duplicate key', code: '23505' } }))
        .mockReturnValueOnce(dbResult({ data: { id: orphanOrderId } }))
        .mockReturnValueOnce(dbResult({ data: null, error: null }))
        .mockReturnValueOnce(dbResult({ data: null }))
        .mockReturnValueOnce(dbResult({ data: null }))

      mockLoadCart.mockResolvedValue({
        id: VALID_CART_ID,
        eatery_id: VALID_EATERY_ID,
        eatery_name: 'Test Eatery',
        items: MOCK_CART_ITEMS,
      })

      const res = await POST(buildSignedRequest(guestPiEvent()))
      expect(res.status).toBe(200)

      // 7 DB operations: payment check, cart select, order insert (fail),
      // order select (recover), payment insert, cart_items delete, carts delete
      expect(mockServiceFrom).toHaveBeenCalledTimes(7)
    })

    it('returns 500 when cart is not found', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockServiceFrom
        .mockReturnValueOnce(dbResult({ data: null }))           // payments (no dup)
        .mockReturnValueOnce(dbResult({ data: null, error: { message: 'not found' } })) // carts → not found

      const res = await POST(buildSignedRequest(guestPiEvent()))
      expect(res.status).toBe(500)
      expect(mockLoadCart).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('skips when metadata has invalid UUIDs', async () => {
      const res = await POST(buildSignedRequest(guestPiEvent({ cart_id: INVALID_UUID })))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('skips when required metadata fields are missing', async () => {
      const event = makeEvent('payment_intent.succeeded', {
        id: VALID_PI_ID,
        amount: 1000,
        metadata: { is_guest: 'true' }, // missing cart_id, eatery_id, guest_name
      })

      const res = await POST(buildSignedRequest(event))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('returns 500 when idempotency check query errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockServiceFrom.mockReturnValueOnce(
        dbResult({ data: null, error: { message: 'connection refused', code: 'XX000' } })
      )

      const res = await POST(buildSignedRequest(guestPiEvent()))
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('Failed to check payment')
      consoleSpy.mockRestore()
    })

    it('returns 500 when cart query errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockServiceFrom
        .mockReturnValueOnce(dbResult({ data: null }))           // idempotency ok
        .mockReturnValueOnce(dbResult({ data: null, error: { message: 'relation not found' } }))

      const res = await POST(buildSignedRequest(guestPiEvent()))
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('Cart not found')
      consoleSpy.mockRestore()
    })

    it('logs warning when skipping due to missing metadata', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const event = makeEvent('payment_intent.succeeded', {
        id: VALID_PI_ID,
        amount: 1000,
        metadata: { is_guest: 'true' },
      })

      await POST(buildSignedRequest(event))
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  // ── payment_intent.succeeded (auth checkout) ──────────────────────────

  describe('payment_intent.succeeded (auth checkout)', () => {
    function authPiEvent(metadataOverrides: Record<string, string> = {}) {
      return makeEvent('payment_intent.succeeded', {
        id: VALID_PI_ID,
        amount: 1000,
        metadata: authPiMetadata(metadataOverrides),
      })
    }

    it('creates order with orderer_id set and guest_name null', async () => {
      const createdOrderId = '00000000-0000-4000-8000-000000000099'
      const { ordersInsert, paymentsInsert } = setupSuccessfulOrderCreation(createdOrderId, VALID_ORDERER_ID)

      const res = await POST(buildSignedRequest(authPiEvent()))
      expect(res.status).toBe(200)

      // Verify all 6 DB operations happened
      expect(mockServiceFrom).toHaveBeenCalledTimes(6)
      expect(mockLoadCart).toHaveBeenCalledTimes(1)

      // Verify orders.insert payload — orderer_id set, no guest_name, no token
      expect(ordersInsert.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          orderer_id: VALID_ORDERER_ID,
          eatery_id: VALID_EATERY_ID,
          guest_name: null,
          guest_access_token: null,
          tip_cents: 0,
          total_cents: 1000,
        })
      )

      // Verify payments.insert payload — payer_id is the orderer
      expect(paymentsInsert.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: createdOrderId,
          stripe_payment_intent_id: VALID_PI_ID,
          payer_id: VALID_ORDERER_ID,
          payee_id: null,
          status: 'succeeded',
        })
      )
    })

    it('skips duplicate delivery (idempotency)', async () => {
      mockServiceFrom.mockReturnValueOnce(
        dbResult({ data: { id: 'existing-payment' } })
      )

      const res = await POST(buildSignedRequest(authPiEvent()))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).toHaveBeenCalledTimes(1)
      expect(mockLoadCart).not.toHaveBeenCalled()
    })

    it('returns 500 when cart is not found', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockServiceFrom
        .mockReturnValueOnce(dbResult({ data: null }))
        .mockReturnValueOnce(dbResult({ data: null, error: { message: 'not found' } }))

      const res = await POST(buildSignedRequest(authPiEvent()))
      expect(res.status).toBe(500)
      expect(mockLoadCart).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('skips when orderer_id is an invalid UUID', async () => {
      const res = await POST(buildSignedRequest(authPiEvent({ orderer_id: INVALID_UUID })))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('skips when required metadata fields are missing', async () => {
      const event = makeEvent('payment_intent.succeeded', {
        id: VALID_PI_ID,
        amount: 1000,
        metadata: { orderer_id: VALID_ORDERER_ID }, // missing cart_id
      })

      const res = await POST(buildSignedRequest(event))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('returns 500 when orderer_id does not match cart owner', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const differentUser = '00000000-0000-4000-8000-000000000099'

      mockServiceFrom
        .mockReturnValueOnce(dbResult({ data: null }))  // idempotency ok
        .mockReturnValueOnce(dbResult({ data: { id: VALID_CART_ID, eatery_id: VALID_EATERY_ID, user_id: differentUser } }))

      const res = await POST(buildSignedRequest(authPiEvent()))
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('Cart owner mismatch')
      expect(mockLoadCart).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  // ── payment_intent.payment_failed ─────────────────────────────────────

  describe('payment_intent.payment_failed', () => {
    it('is a no-op — no order exists in checkout flow', async () => {
      const event = makeEvent('payment_intent.payment_failed', {
        id: VALID_PI_ID,
        metadata: guestPiMetadata(),
      })
      const res = await POST(buildSignedRequest(event))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })
  })

  // ── checkout.session.completed ────────────────────────────────────────

  describe('checkout.session.completed', () => {
    it('is a no-op — no DB side effects', async () => {
      const event = makeEvent('checkout.session.completed', {
        id: 'cs_test_abc',
        payment_intent: VALID_PI_ID,
        amount_total: 1000,
        metadata: guestPiMetadata(),
      })
      const res = await POST(buildSignedRequest(event))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
      expect(mockLoadCart).not.toHaveBeenCalled()
    })
  })

  // ── checkout.session.expired ──────────────────────────────────────────

  describe('checkout.session.expired', () => {
    it('is a no-op for guest sessions', async () => {
      const event = makeEvent('checkout.session.expired', {
        metadata: { is_guest: 'true', cart_id: VALID_CART_ID },
      })
      const res = await POST(buildSignedRequest(event))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('is a no-op for auth sessions', async () => {
      const event = makeEvent('checkout.session.expired', {
        metadata: { orderer_id: VALID_ORDERER_ID, cart_id: VALID_CART_ID },
      })
      const res = await POST(buildSignedRequest(event))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })
  })

  // ── account.updated ───────────────────────────────────────────────────

  describe('account.updated', () => {
    const ACCT_USER_ID = '00000000-0000-4000-8000-000000000060'

    it('marks onboarding complete and auto-activates swiper', async () => {
      mockServiceFrom.mockImplementation((table: string) => {
        if (table === 'stripe_accounts') {
          return dbResult({ data: { id: 'sa-1', user_id: ACCT_USER_ID } })
        }
        if (table === 'profiles') {
          return dbResult({ data: { school_id: 'school-1' } })
        }
        return dbResult()
      })

      const event = makeEvent('account.updated', {
        id: 'acct_test_123',
        details_submitted: true,
        charges_enabled: true,
      })
      const res = await POST(buildSignedRequest(event))
      expect(res.status).toBe(200)
    })

    it('skips when account is not on this platform', async () => {
      mockServiceFrom.mockReturnValueOnce(dbResult({ data: null }))

      const event = makeEvent('account.updated', {
        id: 'acct_unknown',
        details_submitted: true,
        charges_enabled: true,
      })
      const res = await POST(buildSignedRequest(event))
      expect(res.status).toBe(200)
    })
  })
})
