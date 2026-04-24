/**
 * @file webhooks.test.ts
 * @description Unit tests for the Stripe webhook route handler. Covers
 *   signature verification, event idempotency (stripe_events upsert),
 *   payment_intent.succeeded order creation + metadata validation,
 *   account.updated persistence + onboarding downgrade,
 *   charge.dispute.created / closed, and charge.refunded.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'

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
// dbResult — typed mock chain builder. Returns a value chain that supports
// the supabase-js fluent shape used across our handlers.
// ---------------------------------------------------------------------------

interface MockChain {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  then: (resolve: (v: { data?: unknown; error?: unknown }) => void) => Promise<unknown>
}

function dbResult(
  result: { data?: unknown; error?: unknown } = { data: null, error: null }
): MockChain {
  const chain: Partial<MockChain> = {}
  const methods: (keyof MockChain)[] = [
    'select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'is',
  ]
  for (const m of methods) {
    ;(chain as Record<string, unknown>)[m] = vi.fn(() => chain)
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve(result))
  chain.single = vi.fn(() => Promise.resolve(result))
  chain.then = (resolve) => Promise.resolve(result).then(resolve)
  return chain as MockChain
}

/**
 * Returns a stripe_events chain that reports "row inserted" (isDuplicate=false).
 */
function freshEvent(): MockChain {
  const chain = dbResult({ data: [{ id: 'evt-row-1' }], error: null })
  return chain
}

/**
 * Returns a stripe_events chain that reports "row existed already"
 * (isDuplicate=true, short-circuits handler).
 */
function duplicateEvent(): MockChain {
  return dbResult({ data: [], error: null })
}

// ---------------------------------------------------------------------------

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

function makeEvent(type: string, object: Record<string, unknown>, id = `evt_${Date.now()}`) {
  return { id, object: 'event', type, data: { object } }
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

/**
 * Table-dispatch mock for the happy-path PI handler:
 *   1. stripe_events    → insert succeeds (not duplicate)
 *   2. payments select  → not found (not yet recorded)
 *   3. orders insert    → returns orderId
 *   4. payments insert  → ok
 */
function setupHappyPath(orderId = '00000000-0000-4000-8000-000000000099') {
  const paymentsCheck = dbResult({ data: null })
  const ordersInsert = dbResult({ data: { id: orderId } })
  const paymentsInsert = dbResult({ data: null, error: null })

  const paymentsCalls: MockChain[] = []

  mockServiceFrom.mockImplementation((table: string): MockChain => {
    if (table === 'stripe_events') return freshEvent()
    if (table === 'payments') {
      paymentsCalls.push(paymentsCheck)
      return paymentsCalls.length === 1 ? paymentsCheck : paymentsInsert
    }
    if (table === 'orders') return ordersInsert
    return dbResult()
  })

  return { paymentsCheck, ordersInsert, paymentsInsert }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
})

describe('POST /api/stripe/webhooks', () => {
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

    it('never touches the DB on invalid signature (not even stripe_events)', async () => {
      await POST(buildBadSigRequest(makeEvent('payment_intent.succeeded', { id: VALID_PI_ID })))
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('accepts a valid signature and returns 200 for unknown event types', async () => {
      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return freshEvent()
        return dbResult()
      })
      const res = await POST(buildSignedRequest(makeEvent('unknown.event', {})))
      expect(res.status).toBe(200)
    })
  })

  describe('idempotency (finding #9)', () => {
    it('short-circuits with duplicate=true on replay', async () => {
      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return duplicateEvent()
        return dbResult()
      })

      const res = await POST(buildSignedRequest(guestPiEvent()))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.duplicate).toBe(true)
    })

    it('does not touch business tables when event is a duplicate', async () => {
      const businessCalls: string[] = []
      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return duplicateEvent()
        businessCalls.push(table)
        return dbResult()
      })

      await POST(buildSignedRequest(guestPiEvent()))
      expect(businessCalls).toEqual([])
    })
  })

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

      const insertArg = ordersInsert.insert.mock.calls[0][0] as Record<string, unknown>
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

  describe('payment_intent.succeeded row-level idempotency', () => {
    it('skips when payment already exists for this PI', async () => {
      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return freshEvent()
        if (table === 'payments') return dbResult({ data: { id: 'existing-payment' } })
        return dbResult()
      })

      const res = await POST(buildSignedRequest(guestPiEvent()))
      expect(res.status).toBe(200)
    })
  })

  describe('payment_intent.succeeded metadata validation', () => {
    function setupEventOnly() {
      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return freshEvent()
        return dbResult()
      })
    }

    it('skips when school_id is not a UUID', async () => {
      setupEventOnly()
      const res = await POST(buildSignedRequest(guestPiEvent({ school_id: INVALID_UUID })))
      expect(res.status).toBe(200)
    })

    it('skips when cart_screenshot_paths contains invalid path', async () => {
      setupEventOnly()
      const res = await POST(
        buildSignedRequest(guestPiEvent({ cart_screenshot_paths: 'orders/foo.png' }))
      )
      expect(res.status).toBe(200)
    })

    it('skips when total_cents is non-numeric', async () => {
      setupEventOnly()
      const res = await POST(buildSignedRequest(guestPiEvent({ total_cents: 'banana' })))
      expect(res.status).toBe(200)
    })

    it('skips when restaurant_name is empty after trim', async () => {
      setupEventOnly()
      const res = await POST(buildSignedRequest(guestPiEvent({ restaurant_name: '   ' })))
      expect(res.status).toBe(200)
    })

    it('skips when screenshot count exceeds 5', async () => {
      setupEventOnly()
      const tooMany = Array(6).fill(VALID_PATH).join(',')
      const res = await POST(buildSignedRequest(guestPiEvent({ cart_screenshot_paths: tooMany })))
      expect(res.status).toBe(200)
    })

    it('skips guest payload missing guest_name', async () => {
      setupEventOnly()
      const res = await POST(buildSignedRequest(guestPiEvent({ guest_name: '' })))
      expect(res.status).toBe(200)
    })

    it('skips auth payload with invalid orderer_id UUID', async () => {
      setupEventOnly()
      const res = await POST(buildSignedRequest(authPiEvent({ orderer_id: INVALID_UUID })))
      expect(res.status).toBe(200)
    })
  })

  describe('account.updated (findings #3 + #12)', () => {
    const ACCT_USER_ID = '00000000-0000-4000-8000-000000000060'

    it('persists the full Connect state and activates swiper when onboarding crosses to true', async () => {
      const stripeAccountsUpdate = dbResult()
      const profilesUpdate = dbResult()

      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return freshEvent()
        if (table === 'stripe_accounts') {
          // First call selects, second call updates.
          const calls = mockServiceFrom.mock.calls.filter((c: unknown[]) => c[0] === 'stripe_accounts').length
          return calls === 1
            ? dbResult({ data: { id: 'sa-1', user_id: ACCT_USER_ID, onboarding_complete: false } })
            : stripeAccountsUpdate
        }
        if (table === 'profiles') {
          const calls = mockServiceFrom.mock.calls.filter((c: unknown[]) => c[0] === 'profiles').length
          return calls === 1
            ? dbResult({ data: { school_id: 'school-1' } })
            : profilesUpdate
        }
        return dbResult()
      })

      const res = await POST(
        buildSignedRequest(
          makeEvent('account.updated', {
            id: 'acct_test_123',
            details_submitted: true,
            charges_enabled: true,
            payouts_enabled: true,
            requirements: { disabled_reason: null, currently_due: [] },
          })
        )
      )
      expect(res.status).toBe(200)

      expect(stripeAccountsUpdate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          onboarding_complete: true,
          charges_enabled: true,
          payouts_enabled: true,
          disabled_reason: null,
          currently_due: [],
        })
      )
      expect(profilesUpdate.update).toHaveBeenCalledWith({ is_swiper: true })
    })

    it('DOWNGRADES onboarding_complete when charges_enabled becomes false', async () => {
      const stripeAccountsUpdate = dbResult()

      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return freshEvent()
        if (table === 'stripe_accounts') {
          const calls = mockServiceFrom.mock.calls.filter((c: unknown[]) => c[0] === 'stripe_accounts').length
          return calls === 1
            ? dbResult({ data: { id: 'sa-1', user_id: ACCT_USER_ID, onboarding_complete: true } })
            : stripeAccountsUpdate
        }
        return dbResult()
      })

      await POST(
        buildSignedRequest(
          makeEvent('account.updated', {
            id: 'acct_test_123',
            details_submitted: true,
            charges_enabled: false,
            payouts_enabled: false,
            requirements: { disabled_reason: 'requirements.past_due', currently_due: ['individual.dob.day'] },
          })
        )
      )

      expect(stripeAccountsUpdate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          onboarding_complete: false,
          charges_enabled: false,
          disabled_reason: 'requirements.past_due',
        })
      )
    })

    it('skips when account is not on this platform', async () => {
      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return freshEvent()
        if (table === 'stripe_accounts') return dbResult({ data: null })
        return dbResult()
      })
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

  describe('dispute lifecycle (finding #2)', () => {
    it('charge.dispute.created marks payment disputed', async () => {
      const paymentsUpdate = dbResult()
      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return freshEvent()
        if (table === 'payments') return paymentsUpdate
        return dbResult()
      })

      await POST(
        buildSignedRequest(
          makeEvent('charge.dispute.created', {
            id: 'dp_1',
            payment_intent: VALID_PI_ID,
            status: 'warning_needs_response',
          })
        )
      )

      expect(paymentsUpdate.update).toHaveBeenCalledWith({ status: 'disputed' })
    })

    it('charge.dispute.closed won → status succeeded', async () => {
      const paymentsUpdate = dbResult()
      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return freshEvent()
        if (table === 'payments') return paymentsUpdate
        return dbResult()
      })

      await POST(
        buildSignedRequest(
          makeEvent('charge.dispute.closed', {
            id: 'dp_1',
            payment_intent: VALID_PI_ID,
            status: 'won',
          })
        )
      )

      expect(paymentsUpdate.update).toHaveBeenCalledWith({ status: 'succeeded' })
    })

    it('charge.dispute.closed lost with funds-already-transferred records a transfer_failures note', async () => {
      const transferFailuresInsert = dbResult()
      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return freshEvent()
        if (table === 'payments') {
          return dbResult({ data: { order_id: 'ord-1', payee_id: 'swiper-1' } })
        }
        if (table === 'transfer_failures') return transferFailuresInsert
        return dbResult()
      })

      await POST(
        buildSignedRequest(
          makeEvent('charge.dispute.closed', {
            id: 'dp_2',
            payment_intent: VALID_PI_ID,
            status: 'lost',
          })
        )
      )

      expect(transferFailuresInsert.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: 'ord-1',
          stripe_error_code: 'dispute-lost-post-transfer',
        })
      )
    })

    it('charge.dispute.closed lost with funds NOT transferred does not write a failure note', async () => {
      const transferFailuresInsert = dbResult()
      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return freshEvent()
        if (table === 'payments') {
          return dbResult({ data: { order_id: 'ord-1', payee_id: null } })
        }
        if (table === 'transfer_failures') return transferFailuresInsert
        return dbResult()
      })

      await POST(
        buildSignedRequest(
          makeEvent('charge.dispute.closed', {
            id: 'dp_3',
            payment_intent: VALID_PI_ID,
            status: 'lost',
          })
        )
      )

      expect(transferFailuresInsert.insert).not.toHaveBeenCalled()
    })
  })

  describe('charge.refunded', () => {
    it('marks payment refunded', async () => {
      const paymentsUpdate = dbResult()
      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return freshEvent()
        if (table === 'payments') return paymentsUpdate
        return dbResult()
      })

      await POST(
        buildSignedRequest(
          makeEvent('charge.refunded', {
            id: 'ch_1',
            payment_intent: VALID_PI_ID,
            refunded: true,
          })
        )
      )

      expect(paymentsUpdate.update).toHaveBeenCalledWith({ status: 'refunded' })
    })

    it('is a no-op when payment_intent is null', async () => {
      const paymentsUpdate = dbResult()
      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return freshEvent()
        if (table === 'payments') return paymentsUpdate
        return dbResult()
      })

      await POST(
        buildSignedRequest(
          makeEvent('charge.refunded', { id: 'ch_2', payment_intent: null })
        )
      )

      expect(paymentsUpdate.update).not.toHaveBeenCalled()
    })
  })

  describe('dispute with missing payment_intent (defensive)', () => {
    it('charge.dispute.created warns but does not write when payment_intent is null', async () => {
      const paymentsUpdate = dbResult()
      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return freshEvent()
        if (table === 'payments') return paymentsUpdate
        return dbResult()
      })

      const res = await POST(
        buildSignedRequest(
          makeEvent('charge.dispute.created', { id: 'dp_null', payment_intent: null })
        )
      )

      expect(res.status).toBe(200)
      expect(paymentsUpdate.update).not.toHaveBeenCalled()
    })

    it('charge.dispute.closed with status other than won/lost is a no-op', async () => {
      const paymentsUpdate = dbResult()
      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return freshEvent()
        if (table === 'payments') return paymentsUpdate
        return dbResult()
      })

      await POST(
        buildSignedRequest(
          makeEvent('charge.dispute.closed', {
            id: 'dp_wn',
            payment_intent: VALID_PI_ID,
            status: 'warning_needs_response',
          })
        )
      )

      expect(paymentsUpdate.update).not.toHaveBeenCalled()
    })
  })

  describe('no-op events', () => {
    it('payment_intent.payment_failed is a no-op (beyond stripe_events record)', async () => {
      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return freshEvent()
        return dbResult()
      })
      const res = await POST(
        buildSignedRequest(makeEvent('payment_intent.payment_failed', { id: VALID_PI_ID }))
      )
      expect(res.status).toBe(200)
    })

    it('checkout.session.completed is a no-op', async () => {
      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return freshEvent()
        return dbResult()
      })
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
    })

    it('checkout.session.expired is a no-op', async () => {
      mockServiceFrom.mockImplementation((table: string): MockChain => {
        if (table === 'stripe_events') return freshEvent()
        return dbResult()
      })
      const res = await POST(buildSignedRequest(makeEvent('checkout.session.expired', {})))
      expect(res.status).toBe(200)
    })
  })
})
