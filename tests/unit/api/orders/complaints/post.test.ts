/**
 * @file post.test.ts
 * @description Unit tests for POST/GET /api/orders/[id]/complaints. Covers the
 *   full eligibility pipeline (auth, ownership, completion, 24-hour window,
 *   one-per-order), the Zod body validation, the AI adjudicator branching
 *   (mock + real verdicts) and the auto-refund on `approve_refund`.
 *   Called by: vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))

const {
  mockGetUser,
  mockServerFrom,
  mockServiceFrom,
  mockAdjudicate,
  mockRefundOrder,
  mockSignCart,
  mockSignCompletion,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockServerFrom: vi.fn(),
  mockServiceFrom: vi.fn(),
  mockAdjudicate: vi.fn(),
  mockRefundOrder: vi.fn(),
  mockSignCart: vi.fn(),
  mockSignCompletion: vi.fn(),
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

vi.mock('@/lib/ai/complaint-adjudicator', () => ({
  adjudicateComplaint: mockAdjudicate,
}))

vi.mock('@/lib/stripe/refund', () => ({
  refundOrder: mockRefundOrder,
}))

vi.mock('@/lib/storage/sign-screenshots', () => ({
  signCartScreenshotPaths: mockSignCart,
  signCompletionPhotoPath: mockSignCompletion,
}))

import { POST, GET } from '@/app/api/orders/[id]/complaints/route'

const ORDER_ID = '00000000-0000-4000-8000-000000000111'
const ORDERER_ID = '00000000-0000-4000-8000-000000000aaa'
const OTHER_USER = '00000000-0000-4000-8000-000000000bbb'

function chain(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const mock: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'is', 'in', 'gte', 'order', 'limit']) {
    mock[m] = vi.fn(() => mock)
  }
  mock.single = vi.fn(() => Promise.resolve(result))
  mock.maybeSingle = vi.fn(() => Promise.resolve(result))
  mock.then = (resolve: (v: typeof result) => void) =>
    Promise.resolve(result).then(resolve)
  return mock
}

function nowMinus(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    orderer_id: ORDERER_ID,
    status: 'completed',
    completed_at: nowMinus(1),
    restaurant_name: 'Chipotle',
    total_cents: 1500,
    cart_screenshot_urls: ['pre-checkout/abc123XYZ_/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png'],
    ...overrides,
  }
}

function buildPostRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/orders/${ORDER_ID}/complaints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function buildGetRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/orders/${ORDER_ID}/complaints`, {
    method: 'GET',
  })
}

const baseBody = {
  category: 'missing_items',
  reason_text: 'Two of my burritos were missing from the order I picked up.',
}

// Per-table queues — chains are looked up by table name so test setup can
// register them in any order.
let serverQueues: Record<string, ReturnType<typeof chain>[]> = {}
let serviceQueues: Record<string, ReturnType<typeof chain>[]> = {}

function queueServer(table: string, ...chains: ReturnType<typeof chain>[]) {
  serverQueues[table] = (serverQueues[table] ?? []).concat(chains)
}

function queueService(table: string, ...chains: ReturnType<typeof chain>[]) {
  serviceQueues[table] = (serviceQueues[table] ?? []).concat(chains)
}

beforeEach(() => {
  vi.clearAllMocks()
  serverQueues = {}
  serviceQueues = {}

  mockGetUser.mockResolvedValue({ data: { user: { id: ORDERER_ID } }, error: null })

  mockServerFrom.mockImplementation((table: string) => {
    const next = serverQueues[table]?.shift()
    return next ?? chain()
  })
  mockServiceFrom.mockImplementation((table: string) => {
    const next = serviceQueues[table]?.shift()
    return next ?? chain()
  })

  mockSignCart.mockResolvedValue(['https://signed.test/cart-1.png'])
  mockSignCompletion.mockResolvedValue('https://signed.test/completion.png')
})

describe('POST /api/orders/[id]/complaints', () => {
  it('returns 401 when caller is unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(buildPostRequest(baseBody), {
      params: Promise.resolve({ id: ORDER_ID }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 when reason_text is too short', async () => {
    queueServer('orders', chain({ data: orderRow() }))
    const res = await POST(
      buildPostRequest({ category: 'wrong_items', reason_text: 'too short' }),
      { params: Promise.resolve({ id: ORDER_ID }) }
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when category is missing', async () => {
    const res = await POST(
      buildPostRequest({ reason_text: 'A long enough complaint reason here please.' }),
      { params: Promise.resolve({ id: ORDER_ID }) }
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when order does not exist', async () => {
    queueServer('orders', chain({ data: null }))
    const res = await POST(buildPostRequest(baseBody), {
      params: Promise.resolve({ id: ORDER_ID }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 403 when caller is not the orderer', async () => {
    queueServer('orders', chain({ data: orderRow({ orderer_id: OTHER_USER }) }))
    const res = await POST(buildPostRequest(baseBody), {
      params: Promise.resolve({ id: ORDER_ID }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 400 when order is not completed', async () => {
    queueServer('orders', chain({ data: orderRow({ status: 'in_progress', completed_at: null }) }))
    const res = await POST(buildPostRequest(baseBody), {
      params: Promise.resolve({ id: ORDER_ID }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 410 when complaint window has expired (>24h)', async () => {
    queueServer('orders', chain({ data: orderRow({ completed_at: nowMinus(25) }) }))
    const res = await POST(buildPostRequest(baseBody), {
      params: Promise.resolve({ id: ORDER_ID }),
    })
    expect(res.status).toBe(410)
  })

  it('returns 409 when a complaint already exists for this order', async () => {
    queueServer('orders', chain({ data: orderRow() }))
    queueServer('complaints', chain({ data: { id: 'existing-complaint' } }))
    const res = await POST(buildPostRequest(baseBody), {
      params: Promise.resolve({ id: ORDER_ID }),
    })
    expect(res.status).toBe(409)
  })

  it('approve_refund verdict triggers refundOrder and returns the resolved row', async () => {
    queueServer('orders', chain({ data: orderRow() }))
    queueServer('complaints', chain({ data: null }))
    queueService('conversations', chain({ data: { id: 'convo-1' } }))
    queueService('messages', chain({ data: { image_url: 'completion-photos/abc.png' } }))
    queueService(
      'complaints',
      chain({ data: { id: 'new-complaint-1' } }), // insert
      chain({ data: [] }),                         // hasRecentApprovedRefund: empty
      chain({
        data: {
          id: 'new-complaint-1',
          verdict: 'approve_refund',
          ai_confidence: 0.92,
          refund_amount_cents: 1500,
        },
      })
    )

    mockAdjudicate.mockResolvedValue({
      verdict: 'approve_refund',
      confidence: 0.92,
      reasoning: 'Cart shows 4 entrees; completion photo shows 2.',
      evidence_citations: [],
    })
    mockRefundOrder.mockResolvedValue({ refundId: 're_test', amountCents: 1500 })

    const res = await POST(buildPostRequest(baseBody), {
      params: Promise.resolve({ id: ORDER_ID }),
    })

    expect(res.status).toBe(200)
    expect(mockRefundOrder).toHaveBeenCalledTimes(1)
    expect(mockRefundOrder.mock.calls[0][0]).toBe(ORDER_ID)
    const body = await res.json()
    expect(body.complaint.verdict).toBe('approve_refund')
  })

  it('deny verdict does NOT call refundOrder', async () => {
    queueServer('orders', chain({ data: orderRow() }))
    queueServer('complaints', chain({ data: null }))
    queueService('conversations', chain({ data: { id: 'convo-2' } }))
    queueService('messages', chain({ data: { image_url: 'x.png' } }))
    queueService(
      'complaints',
      chain({ data: { id: 'new-complaint-2' } }),
      chain({ data: { id: 'new-complaint-2', verdict: 'deny', ai_confidence: 0.8 } })
    )

    mockAdjudicate.mockResolvedValue({
      verdict: 'deny',
      confidence: 0.8,
      reasoning: 'Photos show all items present.',
      evidence_citations: [],
    })

    const res = await POST(buildPostRequest(baseBody), {
      params: Promise.resolve({ id: ORDER_ID }),
    })
    expect(res.status).toBe(200)
    expect(mockRefundOrder).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.complaint.verdict).toBe('deny')
  })

  it('escalate verdict leaves verdict pending-style and does NOT refund', async () => {
    queueServer('orders', chain({ data: orderRow() }))
    queueServer('complaints', chain({ data: null }))
    queueService('conversations', chain({ data: { id: 'convo-3' } }))
    queueService('messages', chain({ data: { image_url: 'x.png' } }))
    queueService(
      'complaints',
      chain({ data: { id: 'new-complaint-3' } }),
      chain({ data: { id: 'new-complaint-3', verdict: 'escalate', ai_confidence: 0.5 } })
    )

    mockAdjudicate.mockResolvedValue({
      verdict: 'escalate',
      confidence: 0.5,
      reasoning: 'Mock mode.',
      evidence_citations: [],
    })

    const res = await POST(buildPostRequest(baseBody), {
      params: Promise.resolve({ id: ORDER_ID }),
    })
    expect(res.status).toBe(200)
    expect(mockRefundOrder).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.complaint.verdict).toBe('escalate')
  })

  it('persists pending verdict if refund fires but throws', async () => {
    queueServer('orders', chain({ data: orderRow() }))
    queueServer('complaints', chain({ data: null }))
    queueService('conversations', chain({ data: { id: 'convo-4' } }))
    queueService('messages', chain({ data: { image_url: 'x.png' } }))
    queueService(
      'complaints',
      chain({ data: { id: 'cid-4' } }),    // insert
      chain({ data: [] }),                  // hasRecentApprovedRefund: empty
      chain({ data: { id: 'cid-4', verdict: 'pending' } })
    )

    mockAdjudicate.mockResolvedValue({
      verdict: 'approve_refund',
      confidence: 0.9,
      reasoning: 'ok',
      evidence_citations: [],
    })
    mockRefundOrder.mockRejectedValue(new Error('stripe down'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(buildPostRequest(baseBody), {
      params: Promise.resolve({ id: ORDER_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.complaint.verdict).toBe('pending')
    consoleSpy.mockRestore()
  })

  it('downgrades approve_refund to escalate when the orderer already had a recent auto-refund', async () => {
    queueServer('orders', chain({ data: orderRow() }))
    queueServer('complaints', chain({ data: null }))
    queueService('conversations', chain({ data: { id: 'convo-rate' } }))
    queueService('messages', chain({ data: { image_url: 'x.png' } }))
    queueService(
      'complaints',
      chain({ data: { id: 'cid-rate' } }),                         // insert
      chain({ data: [{ id: 'prev-approved' }] }),                  // hasRecentApprovedRefund: HIT
      chain({ data: { id: 'cid-rate', verdict: 'escalate' } })      // final update
    )

    mockAdjudicate.mockResolvedValue({
      verdict: 'approve_refund',
      confidence: 0.95,
      reasoning: 'looks legit',
      evidence_citations: [],
    })

    const res = await POST(buildPostRequest(baseBody), {
      params: Promise.resolve({ id: ORDER_ID }),
    })
    expect(res.status).toBe(200)
    expect(mockRefundOrder).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.complaint.verdict).toBe('escalate')
  })

  it('returns 409 when the DB trigger rejects the insert (post-API race)', async () => {
    queueServer('orders', chain({ data: orderRow() }))
    queueServer('complaints', chain({ data: null }))
    queueService('conversations', chain({ data: { id: 'convo-5' } }))
    queueService('messages', chain({ data: { image_url: 'x.png' } }))
    queueService(
      'complaints',
      chain({
        data: null,
        error: { message: 'complaint window for order ... has expired' },
      })
    )

    const res = await POST(buildPostRequest(baseBody), {
      params: Promise.resolve({ id: ORDER_ID }),
    })
    expect(res.status).toBe(409)
    expect(mockAdjudicate).not.toHaveBeenCalled()
  })
})

describe('GET /api/orders/[id]/complaints', () => {
  it('returns 401 when caller is unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(buildGetRequest(), {
      params: Promise.resolve({ id: ORDER_ID }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 404 when no complaint exists for the order', async () => {
    queueServer('complaints', chain({ data: null }))
    const res = await GET(buildGetRequest(), {
      params: Promise.resolve({ id: ORDER_ID }),
    })
    expect(res.status).toBe(404)
  })

  it('returns the complaint row when one exists', async () => {
    queueServer(
      'complaints',
      chain({
        data: {
          id: 'cid-9',
          order_id: ORDER_ID,
          verdict: 'approve_refund',
          ai_confidence: 0.95,
        },
      })
    )
    const res = await GET(buildGetRequest(), {
      params: Promise.resolve({ id: ORDER_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.complaint.id).toBe('cid-9')
  })
})
