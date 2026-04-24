/**
 * @file webhook-idempotency.test.ts
 * @description Unit tests for recordEvent: the webhook dedup helper.
 *   Called by: Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { recordEvent } from '@/lib/stripe/webhook-idempotency'

interface MockClient {
  from: ReturnType<typeof vi.fn>
}

function makeClient(result: { data?: unknown; error?: unknown }): MockClient {
  const chain = {
    upsert: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(result),
  }
  return {
    from: vi.fn(() => chain),
  }
}

describe('recordEvent', () => {
  it('returns isDuplicate=false when a new row is inserted', async () => {
    const client = makeClient({ data: [{ id: 'row-1' }], error: null })
    const result = await recordEvent(
      'evt_test_1',
      'payment_intent.succeeded',
      client as unknown as Parameters<typeof recordEvent>[2]
    )
    expect(result.isDuplicate).toBe(false)
    expect(client.from).toHaveBeenCalledWith('stripe_events')
  })

  it('returns isDuplicate=true when upsert is silenced by conflict', async () => {
    const client = makeClient({ data: [], error: null })
    const result = await recordEvent(
      'evt_test_2',
      'charge.dispute.created',
      client as unknown as Parameters<typeof recordEvent>[2]
    )
    expect(result.isDuplicate).toBe(true)
  })

  it('treats null data as duplicate (defensive)', async () => {
    const client = makeClient({ data: null, error: null })
    const result = await recordEvent(
      'evt_test_3',
      'account.updated',
      client as unknown as Parameters<typeof recordEvent>[2]
    )
    expect(result.isDuplicate).toBe(true)
  })

  it('throws when the DB returns an error (webhook must retry)', async () => {
    const client = makeClient({ data: null, error: { message: 'db down' } })
    await expect(
      recordEvent(
        'evt_test_4',
        'payment_intent.succeeded',
        client as unknown as Parameters<typeof recordEvent>[2]
      )
    ).rejects.toMatchObject({ message: 'db down' })
  })
})
