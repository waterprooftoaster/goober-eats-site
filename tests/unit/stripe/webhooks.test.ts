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

// Subtotal $25 → orderer pays $10 (40%), platform $2.50, swiper $7.50.
function guestMetadata(overrides: Record<string, string> = {}) {
  return {
    is_guest: 'true',
    school_id: VALID_SCHOOL_ID,
    restaurant_name: 'Chipotle',
    cart_screenshot_paths: VALID_PATH,
    subtotal_cents: '2500',
    total_cents: '1000',
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
    total_cents: '1000',
    platform_fee_cents: '250',
    orderer_id: VALID_ORDERER_ID,
    ...overrides,
  }
}

function guestCapturableEvent(overrides: Record<string, string> = {}) {
  return makeEvent('payment_intent.amount_capturable_updated', {
    id: VALID_PI_ID,
    amount: 1000,
    amount_capturable: 1000,
    metadata: guestMetadata(overrides),
  })
}

function authCapturableEvent(overrides: Record<string, string> = {}) {
  return makeEvent('payment_intent.amount_capturable_updated', {
    id: VALID_PI_ID,
    amount: 1500,
    amount_capturable: 1500,
    metadata: authMetadata(overrides),
  })
}

function pmSucceededEvent() {
  return makeEvent('payment_intent.succeeded', {
    id: VALID_PI_ID,
    amount: 1000,
    amount_received: 1000,
    metadata: authMetadata(),
  })
}

function pmCanceledEvent() {
  return makeEvent('payment_intent.canceled', {
    id: VALID_PI_ID,
    amount: 1000,
    metadata: authMetadata(),
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

  // ── payment_intent.amount_capturable_updated ────────────────────────
  // Order creation moved here from payment_intent.succeeded after the
  // manual-capture switch. Funds are authorized (uncaptured); payments.status
  // starts at 'pending' and flips to 'succeeded' on the later capture event.

  describe('payment_intent.amount_capturable_updated (guest)', () => {
    it('creates an order with null orderer_id, guest_name, school_id, and cart_screenshot_urls', async () => {
      const { ordersInsert, paymentsInsert } = setupHappyPath()

      const res = await POST(buildSignedRequest(guestCapturableEvent()))
      expect(res.status).toBe(200)

      expect(ordersInsert.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          orderer_id: null,
          school_id: VALID_SCHOOL_ID,
          restaurant_name: 'Chipotle',
          cart_screenshot_urls: [VALID_PATH],
          guest_name: 'Test Guest',
          subtotal_cents: 2500,
          total_cents: 1000,
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
          amount_cents: 1000,
          platform_fee_cents: 250,
          status: 'pending',
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
          guestCapturableEvent({ cart_screenshot_paths: `${VALID_PATH},${path2}` })
        )
      )
      expect(res.status).toBe(200)
    })
  })

  describe('payment_intent.amount_capturable_updated (auth)', () => {
    it('creates order with orderer_id and null guest fields', async () => {
      const { ordersInsert, paymentsInsert } = setupHappyPath()

      const res = await POST(buildSignedRequest(authCapturableEvent()))
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

  describe('payment_intent.amount_capturable_updated idempotency + recovery', () => {
    it('skips duplicate PI delivery', async () => {
      mockServiceFrom.mockReturnValueOnce(dbResult({ data: { id: 'existing-payment' } }))
      const res = await POST(buildSignedRequest(guestCapturableEvent()))
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

      const res = await POST(buildSignedRequest(guestCapturableEvent()))
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

      const res = await POST(buildSignedRequest(guestCapturableEvent()))
      expect(res.status).toBe(200)
    })

    it('returns 500 (retry) when orders.insert fails with a non-permanent error', async () => {
      mockServiceFrom
        .mockReturnValueOnce(dbResult({ data: null }))
        .mockReturnValueOnce(dbResult({ data: null, error: { code: '08006', message: 'connection failure' } }))
        .mockReturnValueOnce(dbResult({ data: null }))

      const res = await POST(buildSignedRequest(guestCapturableEvent()))
      expect(res.status).toBe(500)
    })
  })

  describe('payment_intent.amount_capturable_updated metadata validation', () => {
    it('skips when school_id is not a UUID', async () => {
      const res = await POST(buildSignedRequest(guestCapturableEvent({ school_id: INVALID_UUID })))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('skips when cart_screenshot_paths contains invalid path', async () => {
      const res = await POST(
        buildSignedRequest(guestCapturableEvent({ cart_screenshot_paths: 'orders/foo.png' }))
      )
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('skips when subtotal_cents is non-numeric', async () => {
      const res = await POST(buildSignedRequest(guestCapturableEvent({ subtotal_cents: 'banana' })))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('re-derives platform_fee_cents server-side; tampered metadata is ignored', async () => {
      const { paymentsInsert } = setupHappyPath()
      // Attacker-controlled platform_fee_cents in metadata — should be ignored.
      const res = await POST(
        buildSignedRequest(guestCapturableEvent({ platform_fee_cents: '0', total_cents: '99999' }))
      )
      expect(res.status).toBe(200)
      expect(paymentsInsert.insert).toHaveBeenCalledWith(
        expect.objectContaining({ amount_cents: 1000, platform_fee_cents: 250 })
      )
    })

    it('skips when restaurant_name is empty after trim', async () => {
      const res = await POST(buildSignedRequest(guestCapturableEvent({ restaurant_name: '   ' })))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('skips when screenshot count exceeds 5', async () => {
      const tooMany = Array(6).fill(VALID_PATH).join(',')
      const res = await POST(buildSignedRequest(guestCapturableEvent({ cart_screenshot_paths: tooMany })))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('skips guest payload missing guest_name', async () => {
      const res = await POST(buildSignedRequest(guestCapturableEvent({ guest_name: '' })))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it('skips auth payload with invalid orderer_id UUID', async () => {
      const res = await POST(buildSignedRequest(authCapturableEvent({ orderer_id: INVALID_UUID })))
      expect(res.status).toBe(200)
      expect(mockServiceFrom).not.toHaveBeenCalled()
    })
  })

  // ── payment_intent.succeeded (post-capture) ──────────────────────────
  // After the manual-capture switch this event fires AFTER funds are
  // captured (i.e. after lib/stripe/capture-and-transfer.ts calls
  // paymentIntents.capture during order completion). The handler flips the
  // existing payments row from 'pending' to 'succeeded'. Idempotent because
  // re-delivery just re-issues the same UPDATE.

  describe('payment_intent.succeeded (post-capture)', () => {
    it('flips payments.status to succeeded for the matching PI', async () => {
      const update = dbResult({ data: null, error: null })
      mockServiceFrom.mockReturnValueOnce(update)

      const res = await POST(buildSignedRequest(pmSucceededEvent()))
      expect(res.status).toBe(200)
      expect(update.update).toHaveBeenCalledWith({ status: 'succeeded' })
      expect(update.eq).toHaveBeenCalledWith('stripe_payment_intent_id', VALID_PI_ID)
    })

    it('is idempotent on re-delivery (same UPDATE re-issued)', async () => {
      const first = dbResult({ data: null, error: null })
      const second = dbResult({ data: null, error: null })
      mockServiceFrom.mockReturnValueOnce(first).mockReturnValueOnce(second)

      const r1 = await POST(buildSignedRequest(pmSucceededEvent()))
      const r2 = await POST(buildSignedRequest(pmSucceededEvent()))
      expect(r1.status).toBe(200)
      expect(r2.status).toBe(200)
      expect(first.update).toHaveBeenCalledTimes(1)
      expect(second.update).toHaveBeenCalledTimes(1)
    })

    it('no-ops silently when no payments row exists yet (race)', async () => {
      // Postgres update with 0 affected rows does not error.
      const update = dbResult({ data: null, error: null })
      mockServiceFrom.mockReturnValueOnce(update)

      const res = await POST(buildSignedRequest(pmSucceededEvent()))
      expect(res.status).toBe(200)
    })

    it('returns 500 (Stripe will retry) on DB error', async () => {
      const update = dbResult({ data: null, error: { code: '08006', message: 'connection failure' } })
      mockServiceFrom.mockReturnValueOnce(update)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const res = await POST(buildSignedRequest(pmSucceededEvent()))
      expect(res.status).toBe(500)
      consoleSpy.mockRestore()
    })
  })

  // ── payment_intent.canceled ─────────────────────────────────────────
  // Fires when the auth hold is released — orderer cancel (Phase 3),
  // 24h sweep (Phase 4), or Stripe-side expiry. Mirrors to orders.status
  // = 'cancelled'. Idempotent because re-delivery re-issues the same UPDATE.

  describe('payment_intent.canceled', () => {
    it('flips orders.status to cancelled for the matching PI', async () => {
      const update = dbResult({ data: null, error: null })
      mockServiceFrom.mockReturnValueOnce(update)

      const res = await POST(buildSignedRequest(pmCanceledEvent()))
      expect(res.status).toBe(200)
      expect(update.update).toHaveBeenCalledWith({ status: 'cancelled' })
      expect(update.eq).toHaveBeenCalledWith('stripe_payment_intent_id', VALID_PI_ID)
    })

    it('is idempotent on re-delivery', async () => {
      const first = dbResult({ data: null, error: null })
      const second = dbResult({ data: null, error: null })
      mockServiceFrom.mockReturnValueOnce(first).mockReturnValueOnce(second)

      const r1 = await POST(buildSignedRequest(pmCanceledEvent()))
      const r2 = await POST(buildSignedRequest(pmCanceledEvent()))
      expect(r1.status).toBe(200)
      expect(r2.status).toBe(200)
    })

    it('no-ops silently when no order exists for the PI (canceled before authorize)', async () => {
      const update = dbResult({ data: null, error: null })
      mockServiceFrom.mockReturnValueOnce(update)

      const res = await POST(buildSignedRequest(pmCanceledEvent()))
      expect(res.status).toBe(200)
    })

    it('returns 500 on DB error', async () => {
      const update = dbResult({ data: null, error: { code: '08006', message: 'connection failure' } })
      mockServiceFrom.mockReturnValueOnce(update)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const res = await POST(buildSignedRequest(pmCanceledEvent()))
      expect(res.status).toBe(500)
      consoleSpy.mockRestore()
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

    it('unaccepts in-progress orders, detaches conversations, posts system messages, THEN suspends', async () => {
      const ORDER_1 = '00000000-0000-4000-8000-000000000301'
      const ORDER_2 = '00000000-0000-4000-8000-000000000302'

      const callLog: string[] = []

      const stripeLookup = dbResult({ data: { id: 'sa-1', user_id: ACCT_USER_ID } })
      const ordersUnaccept = dbResult({ data: [{ id: ORDER_1 }, { id: ORDER_2 }] })
      const conversationsDetach = dbResult({ data: null, error: null })
      const conversationsLookup = dbResult({
        data: [
          { id: 'conv-1', order_id: ORDER_1 },
          { id: 'conv-2', order_id: ORDER_2 },
        ],
      })
      const messagesInsert = dbResult({ data: null, error: null })
      const stripeSuspend = dbResult({ data: null, error: null })

      const sequence = [
        { table: 'stripe_accounts', chain: stripeLookup, label: 'stripe_lookup' },
        { table: 'orders', chain: ordersUnaccept, label: 'orders_unaccept' },
        { table: 'conversations', chain: conversationsDetach, label: 'conversations_detach' },
        { table: 'conversations', chain: conversationsLookup, label: 'conversations_lookup' },
        { table: 'messages', chain: messagesInsert, label: 'messages_insert' },
        { table: 'stripe_accounts', chain: stripeSuspend, label: 'stripe_suspend' },
      ]
      let i = 0
      mockServiceFrom.mockImplementation((table: string) => {
        const expected = sequence[i]
        if (!expected || expected.table !== table) {
          callLog.push(`UNEXPECTED ${table} (call #${i})`)
          return dbResult()
        }
        callLog.push(expected.label)
        i += 1
        return expected.chain
      })

      const res = await POST(
        buildSignedRequest(
          makeEvent('account.updated', {
            id: 'acct_test_suspend_with_orders',
            details_submitted: true,
            charges_enabled: false,
            requirements: { disabled_reason: 'rejected.fraud' },
          })
        )
      )
      expect(res.status).toBe(200)

      expect(callLog).toEqual([
        'stripe_lookup',
        'orders_unaccept',
        'conversations_detach',
        'conversations_lookup',
        'messages_insert',
        'stripe_suspend',
      ])

      expect(ordersUnaccept.update).toHaveBeenCalledWith({ status: 'open', swiper_id: null })
      expect(ordersUnaccept.eq).toHaveBeenCalledWith('swiper_id', ACCT_USER_ID)
      expect(ordersUnaccept.eq).toHaveBeenCalledWith('status', 'in_progress')

      expect(conversationsDetach.update).toHaveBeenCalledWith({
        swiper_id: null,
        swiper_assigned_at: null,
      })
      expect(conversationsDetach.in).toHaveBeenCalledWith('order_id', [ORDER_1, ORDER_2])

      expect(messagesInsert.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          conversation_id: 'conv-1',
          sender_id: null,
          message_type: 'system',
          body: 'Your swiper became unavailable. Order returned to queue.',
        }),
        expect.objectContaining({
          conversation_id: 'conv-2',
          message_type: 'system',
        }),
      ])

      expect(stripeSuspend.update).toHaveBeenCalledWith(
        expect.objectContaining({ suspended: true })
      )
    })

    it('skips conversations/messages writes when the swiper has no in_progress orders', async () => {
      const stripeLookup = dbResult({ data: { id: 'sa-1', user_id: ACCT_USER_ID } })
      const ordersUnaccept = dbResult({ data: [] })
      const stripeSuspend = dbResult({ data: null, error: null })

      const tables: string[] = []
      mockServiceFrom.mockImplementation((table: string) => {
        tables.push(table)
        if (table === 'stripe_accounts') {
          const stripeCallCount = tables.filter((t) => t === 'stripe_accounts').length
          return stripeCallCount === 1 ? stripeLookup : stripeSuspend
        }
        if (table === 'orders') return ordersUnaccept
        return dbResult()
      })

      const res = await POST(
        buildSignedRequest(
          makeEvent('account.updated', {
            id: 'acct_no_orders',
            requirements: { disabled_reason: 'rejected.terms_of_service' },
          })
        )
      )
      expect(res.status).toBe(200)

      expect(tables.filter((t) => t === 'conversations')).toHaveLength(0)
      expect(tables.filter((t) => t === 'messages')).toHaveLength(0)
      expect(stripeSuspend.update).toHaveBeenCalledWith(
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
            amount_total: 1000,
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
