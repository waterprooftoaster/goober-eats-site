/**
 * @file status.test.ts
 * @description Unit tests for PATCH /api/orders/[id]/status — verifies that
 *   status transitions (un-accept, cancelled, completed) do NOT insert system
 *   messages into the conversation; status notifications are rendered
 *   client-side as pseudo-messages, never persisted as DB rows.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetUser,
  mockServerFrom,
  mockServiceFrom,
  mockCaptureAndTransfer,
  mockSignCartScreenshotPaths,
  mockPaymentIntentsCancel,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockServerFrom: vi.fn(),
  mockServiceFrom: vi.fn(),
  mockCaptureAndTransfer: vi.fn().mockResolvedValue({ ok: true }),
  mockSignCartScreenshotPaths: vi.fn(),
  mockPaymentIntentsCancel: vi.fn().mockResolvedValue({ id: 'pi_cancelled' }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockServerFrom,
  })),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom })),
}))

vi.mock('@/lib/stripe/capture-and-transfer', () => ({
  captureAndTransfer: mockCaptureAndTransfer,
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripe: vi.fn(() => ({
    paymentIntents: { cancel: mockPaymentIntentsCancel },
  })),
}))

vi.mock('@/lib/storage/sign-screenshots', () => ({
  signCartScreenshotPaths: mockSignCartScreenshotPaths,
}))

import { PATCH } from '@/app/api/orders/[id]/status/route'

function dbResult(result: { data?: unknown; error?: unknown; count?: number } = { data: null, error: null }) {
  const mock: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'is']) {
    mock[m] = vi.fn(() => mock)
  }
  mock.single = vi.fn(() => Promise.resolve(result))
  mock.maybeSingle = vi.fn(() => Promise.resolve(result))
  mock.then = (resolve: (v: typeof result) => void) =>
    Promise.resolve(result).then(resolve)
  return mock
}

const SWIPER_ID = '00000000-0000-4000-8000-000000000001'
const ORDERER_ID = '00000000-0000-4000-8000-000000000002'
const ORDER_ID = '00000000-0000-4000-8000-000000000100'

async function callPatch(status: string): Promise<Response> {
  const req = new NextRequest(`http://localhost/api/orders/${ORDER_ID}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return PATCH(req, { params: Promise.resolve({ id: ORDER_ID }) })
}

/** Absorbs the lib/api/helpers.ts:getAuthenticatedUser suspension SELECT. */
function primeSuspensionMock(): void {
  mockServerFrom.mockReturnValueOnce(dbResult({ data: null }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: SWIPER_ID } }, error: null })
  mockSignCartScreenshotPaths.mockImplementation(async (paths: string[]) =>
    paths.map((p) => `https://signed.test/${p}`)
  )
})

describe('PATCH /api/orders/[id]/status — does not persist system messages', () => {
  it('does NOT insert a messages row on un-accept (in_progress → open) and still clears conversations.swiper_id', async () => {
    // Server client chain (in order):
    //   0. stripe_accounts.select (suspension gate inside getAuthenticatedUser)
    //   1. orders.select (current row)
    primeSuspensionMock()
    mockServerFrom.mockReturnValueOnce(
      dbResult({
        data: {
          id: ORDER_ID,
          orderer_id: ORDERER_ID,
          swiper_id: SWIPER_ID,
          status: 'in_progress',
        },
      })
    )

    // Service client chain (in order):
    //   1. orders.update (status=open, swiper_id=null) — atomic
    //   2. conversations.update (swiper_id=null)
    const updatedOrder = {
      id: ORDER_ID,
      orderer_id: ORDERER_ID,
      swiper_id: null,
      school_id: '00000000-0000-4000-8000-000000000aaa',
      restaurant_name: 'Chipotle',
      cart_screenshot_urls: [],
      status: 'open',
      subtotal_cents: 2500,
      total_cents: 1500,
      guest_name: null,
      guest_email: null,
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    }
    const orderUpdateChain = dbResult({ data: updatedOrder })
    const convUpdateChain = dbResult({ data: null, error: null })
    mockServiceFrom.mockReturnValueOnce(orderUpdateChain).mockReturnValueOnce(convUpdateChain)

    const res = await callPatch('open')
    expect(res.status).toBe(200)

    // Conversation revoke still happens
    expect(convUpdateChain.update).toHaveBeenCalledWith({
      swiper_id: null,
      swiper_assigned_at: null,
    })
    expect(convUpdateChain.eq).toHaveBeenCalledWith('order_id', ORDER_ID)

    // No messages row inserted across either client
    expectNoMessagesInsert(mockServerFrom, mockServiceFrom)
  })

  it('returns the updated order with cart_screenshot_urls signed', async () => {
    primeSuspensionMock()
    mockServerFrom.mockReturnValueOnce(
      dbResult({
        data: {
          id: ORDER_ID,
          orderer_id: ORDERER_ID,
          swiper_id: SWIPER_ID,
          status: 'in_progress',
        },
      })
    )

    const path = 'pre-checkout/abc/00000000-0000-4000-8000-000000000010.jpg'
    const updatedOrder = {
      id: ORDER_ID,
      orderer_id: ORDERER_ID,
      swiper_id: null,
      school_id: '00000000-0000-4000-8000-000000000aaa',
      restaurant_name: 'Chipotle',
      cart_screenshot_urls: [path],
      status: 'open',
      subtotal_cents: 2500,
      total_cents: 1500,
      guest_name: null,
      guest_email: null,
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    }
    mockServiceFrom
      .mockReturnValueOnce(dbResult({ data: updatedOrder }))
      .mockReturnValueOnce(dbResult({ data: null, error: null }))

    const res = await callPatch('open')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cart_screenshot_urls).toEqual([`https://signed.test/${path}`])
    expect(mockSignCartScreenshotPaths).toHaveBeenCalledWith([path])
  })

  it('does NOT insert a messages row on cancel (open → cancelled)', async () => {
    // Orderer cancels their own order from open
    mockGetUser.mockResolvedValue({ data: { user: { id: ORDERER_ID } }, error: null })
    primeSuspensionMock()
    mockServerFrom.mockReturnValueOnce(
      dbResult({
        data: {
          id: ORDER_ID,
          orderer_id: ORDERER_ID,
          swiper_id: null,
          status: 'open',
          stripe_payment_intent_id: 'pi_test_cancel',
        },
      })
    )

    const cancelledOrder = {
      id: ORDER_ID,
      orderer_id: ORDERER_ID,
      swiper_id: null,
      school_id: '00000000-0000-4000-8000-000000000aaa',
      restaurant_name: 'Chipotle',
      cart_screenshot_urls: [],
      status: 'cancelled',
      subtotal_cents: 2500,
      total_cents: 1500,
      guest_name: null,
      guest_email: null,
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    }
    // Cancel uses the user (server) client for the orders update — not service
    mockServerFrom.mockReturnValueOnce(dbResult({ data: cancelledOrder }))

    const res = await callPatch('cancelled')
    expect(res.status).toBe(200)
    expectNoMessagesInsert(mockServerFrom, mockServiceFrom)
  })

  it('does NOT insert a messages row on complete (in_progress → completed)', async () => {
    primeSuspensionMock()
    mockServerFrom
      // 1. orders.select
      .mockReturnValueOnce(
        dbResult({
          data: {
            id: ORDER_ID,
            orderer_id: ORDERER_ID,
            swiper_id: SWIPER_ID,
            status: 'in_progress',
          },
        })
      )
      // 2. conversations.select (lookup conv id for completion-photo gate)
      .mockReturnValueOnce(dbResult({ data: { id: 'conv-1' } }))
      // 3. messages.select count (head:true) — completion-photo gate
      .mockReturnValueOnce(dbResult({ count: 1, error: null }))

    const completedOrder = {
      id: ORDER_ID,
      orderer_id: ORDERER_ID,
      swiper_id: SWIPER_ID,
      school_id: '00000000-0000-4000-8000-000000000aaa',
      restaurant_name: 'Chipotle',
      cart_screenshot_urls: [],
      status: 'completed',
      subtotal_cents: 2500,
      total_cents: 1500,
      guest_name: null,
      guest_email: null,
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    }
    // Service client: payments.select (completion gate)
    mockServiceFrom.mockReturnValueOnce(dbResult({ data: { id: 'pay-1', status: 'pending' } }))

    // The completion path uses the user client for orders.update (un-accept is
    // the only branch that uses the service client for orders.update).
    mockServerFrom.mockReturnValueOnce(dbResult({ data: completedOrder }))

    const res = await callPatch('completed')
    expect(res.status).toBe(200)
    expectNoMessagesInsert(mockServerFrom, mockServiceFrom)
  })
})

describe('PATCH /api/orders/[id]/status — completion branches under manual capture', () => {
  function primeCompletionMocks() {
    primeSuspensionMock()
    mockServerFrom
      .mockReturnValueOnce(
        dbResult({
          data: {
            id: ORDER_ID,
            orderer_id: ORDERER_ID,
            swiper_id: SWIPER_ID,
            status: 'in_progress',
          },
        })
      )
      .mockReturnValueOnce(dbResult({ data: { id: 'conv-1' } }))
      .mockReturnValueOnce(dbResult({ count: 1, error: null }))

    mockServiceFrom.mockReturnValueOnce(dbResult({ data: { id: 'pay-1', status: 'pending' } }))
  }

  function completedOrderRow() {
    return {
      id: ORDER_ID,
      orderer_id: ORDERER_ID,
      swiper_id: SWIPER_ID,
      school_id: '00000000-0000-4000-8000-000000000aaa',
      restaurant_name: 'Chipotle',
      cart_screenshot_urls: [],
      status: 'completed',
      subtotal_cents: 2500,
      total_cents: 1500,
      guest_name: null,
      guest_email: null,
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    }
  }

  it('returns 200 when capture and transfer both succeed', async () => {
    primeCompletionMocks()
    mockServerFrom.mockReturnValueOnce(dbResult({ data: completedOrderRow() }))
    mockCaptureAndTransfer.mockResolvedValueOnce({ ok: true })

    const res = await callPatch('completed')
    expect(res.status).toBe(200)
    expect(mockCaptureAndTransfer).toHaveBeenCalledWith(ORDER_ID, SWIPER_ID)
  })

  it('returns 200 when capture succeeds but transfer is stuck (food delivered, ops resolves)', async () => {
    primeCompletionMocks()
    mockServerFrom.mockReturnValueOnce(dbResult({ data: completedOrderRow() }))
    mockCaptureAndTransfer.mockResolvedValueOnce({ ok: true, transferStuck: true })

    const res = await callPatch('completed')
    expect(res.status).toBe(200)
    expect(mockCaptureAndTransfer).toHaveBeenCalledWith(ORDER_ID, SWIPER_ID)
  })

  it('returns 409 and rolls back orders.status when capture fails', async () => {
    primeCompletionMocks()
    // CAS update: orders.status to 'completed'
    mockServerFrom.mockReturnValueOnce(dbResult({ data: completedOrderRow() }))
    // Rollback: orders.update WHERE status='completed' SET status='in_progress'
    const rollbackChain = dbResult({ data: null, error: null })
    mockServerFrom.mockReturnValueOnce(rollbackChain)

    mockCaptureAndTransfer.mockResolvedValueOnce({ ok: false, reason: 'capture_failed' })

    const res = await callPatch('completed')
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('Payment authorization expired')

    expect(rollbackChain.update).toHaveBeenCalledWith({ status: 'in_progress' })
    expect(rollbackChain.eq).toHaveBeenCalledWith('id', ORDER_ID)
    expect(rollbackChain.eq).toHaveBeenCalledWith('status', 'completed')
  })

  it('calls paymentIntents.cancel with idempotency key cancel-${orderId} on orderer cancel', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ORDERER_ID } }, error: null })
    primeSuspensionMock()
    mockServerFrom.mockReturnValueOnce(
      dbResult({
        data: {
          id: ORDER_ID,
          orderer_id: ORDERER_ID,
          swiper_id: null,
          status: 'open',
          stripe_payment_intent_id: 'pi_test_cancel',
        },
      })
    )
    mockServerFrom.mockReturnValueOnce(
      dbResult({
        data: {
          id: ORDER_ID,
          orderer_id: ORDERER_ID,
          swiper_id: null,
          school_id: '00000000-0000-4000-8000-000000000aaa',
          restaurant_name: 'Chipotle',
          cart_screenshot_urls: [],
          status: 'cancelled',
          subtotal_cents: 2500,
          total_cents: 1500,
          guest_name: null,
          guest_email: null,
          created_at: '2026-04-22T00:00:00Z',
          updated_at: '2026-04-22T00:00:00Z',
        },
      })
    )

    const res = await callPatch('cancelled')
    expect(res.status).toBe(200)

    expect(mockPaymentIntentsCancel).toHaveBeenCalledWith(
      'pi_test_cancel',
      undefined,
      expect.objectContaining({ idempotencyKey: `cancel-${ORDER_ID}` })
    )
  })

  it('still flips orders.status to cancelled when paymentIntents.cancel throws (PI already captured/canceled)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ORDERER_ID } }, error: null })
    primeSuspensionMock()
    mockServerFrom.mockReturnValueOnce(
      dbResult({
        data: {
          id: ORDER_ID,
          orderer_id: ORDERER_ID,
          swiper_id: null,
          status: 'open',
          stripe_payment_intent_id: 'pi_already_captured',
        },
      })
    )
    const cancelUpdate = dbResult({
      data: {
        id: ORDER_ID,
        orderer_id: ORDERER_ID,
        swiper_id: null,
        school_id: '00000000-0000-4000-8000-000000000aaa',
        restaurant_name: 'Chipotle',
        cart_screenshot_urls: [],
        status: 'cancelled',
        subtotal_cents: 2500,
        total_cents: 1500,
        guest_name: null,
        guest_email: null,
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z',
      },
    })
    mockServerFrom.mockReturnValueOnce(cancelUpdate)

    mockPaymentIntentsCancel.mockRejectedValueOnce(new Error('PI already captured'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await callPatch('cancelled')
    expect(res.status).toBe(200)
    expect(cancelUpdate.update).toHaveBeenCalledWith({ status: 'cancelled' })

    consoleSpy.mockRestore()
  })

  it('rejects cancel from non-orderer with 403', async () => {
    // Authenticated as the swiper, not the orderer
    mockGetUser.mockResolvedValue({ data: { user: { id: SWIPER_ID } }, error: null })
    primeSuspensionMock()
    mockServerFrom.mockReturnValueOnce(
      dbResult({
        data: {
          id: ORDER_ID,
          orderer_id: ORDERER_ID,
          swiper_id: null,
          status: 'open',
          stripe_payment_intent_id: 'pi_test',
        },
      })
    )

    const res = await callPatch('cancelled')
    expect(res.status).toBe(403)
    expect(mockPaymentIntentsCancel).not.toHaveBeenCalled()
  })

  it('returns 400 when payment guard rejects (no payment row in pending/succeeded state)', async () => {
    primeSuspensionMock()
    mockServerFrom.mockReturnValueOnce(
      dbResult({
        data: {
          id: ORDER_ID,
          orderer_id: ORDERER_ID,
          swiper_id: SWIPER_ID,
          status: 'in_progress',
        },
      })
    )
    // payments.select returns null — payment is in failed/refunded or missing
    mockServiceFrom.mockReturnValueOnce(dbResult({ data: null }))

    const res = await callPatch('completed')
    expect(res.status).toBe(400)
    expect(mockCaptureAndTransfer).not.toHaveBeenCalled()
  })
})

// --- Helpers ---

function expectNoMessagesInsert(
  serverFrom: ReturnType<typeof vi.fn>,
  serviceFrom: ReturnType<typeof vi.fn>
): void {
  // Walk every from(...) call across both clients; for any chain bound to the
  // 'messages' table, assert .insert was never invoked. SELECTs (e.g. the
  // completion-photo gate counts existing messages) are allowed.
  for (const fromMock of [serverFrom, serviceFrom]) {
    fromMock.mock.calls.forEach((args, i) => {
      if (args[0] !== 'messages') return
      const result = fromMock.mock.results[i]
      if (result?.type !== 'return') return
      const chain = result.value as { insert?: ReturnType<typeof vi.fn> }
      if (chain.insert) {
        expect(chain.insert).not.toHaveBeenCalled()
      }
    })
  }
}
