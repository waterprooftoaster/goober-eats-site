/**
 * @file channel-registry.test.ts
 * @description TDD-first specs for lib/realtime/channel-registry.ts. The registry
 *   is a ref-counted singleton that wraps Supabase Realtime channel subscriptions
 *   with UUID validation (fail-closed) and idempotent cleanup, per master plan §11.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — hoisted
// ---------------------------------------------------------------------------
const { mockChannel, mockSupabase, channelFactory } = vi.hoisted(() => {
  function makeChannel() {
    const ch: Record<string, unknown> = {}
    ch.on = vi.fn(() => ch)
    ch.subscribe = vi.fn(() => ch)
    ch.unsubscribe = vi.fn(() => ch)
    return ch
  }
  const channelFactory = vi.fn(() => makeChannel())
  const mockSupabase = {
    channel: channelFactory,
    removeChannel: vi.fn(),
  }
  return { mockChannel: makeChannel, mockSupabase, channelFactory }
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

// Import AFTER mocks
import {
  subscribeChannel,
  __resetRegistryForTests,
} from '@/lib/realtime/channel-registry'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const VALID_UUID_A = '11111111-2222-4333-8444-555555555555'
const VALID_UUID_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

beforeEach(() => {
  vi.clearAllMocks()
  channelFactory.mockImplementation(() => mockChannel())
  __resetRegistryForTests()
})

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------
describe('subscribeChannel — happy path', () => {
  it('calls supabase.channel + configure + subscribe exactly once for a fresh channelName', () => {
    const configure = vi.fn((ch) => ch)

    subscribeChannel({
      channelName: `messages:${VALID_UUID_A}`,
      validateUuid: VALID_UUID_A,
      configure,
    })

    expect(channelFactory).toHaveBeenCalledTimes(1)
    expect(channelFactory).toHaveBeenCalledWith(`messages:${VALID_UUID_A}`)
    expect(configure).toHaveBeenCalledTimes(1)
    const created = channelFactory.mock.results[0].value as { subscribe: ReturnType<typeof vi.fn> }
    expect(created.subscribe).toHaveBeenCalledTimes(1)
  })
})

describe('subscribeChannel — UUID validation (fail closed, master plan §11)', () => {
  it('throws AND does NOT call supabase.channel when validateUuid is malformed', () => {
    const configure = vi.fn((ch) => ch)

    expect(() =>
      subscribeChannel({
        channelName: `messages:not-a-uuid`,
        validateUuid: 'not-a-uuid',
        configure,
      })
    ).toThrow(/uuid/i)

    expect(channelFactory).not.toHaveBeenCalled()
    expect(configure).not.toHaveBeenCalled()
  })

  it('throws on a non-UUID-shaped string like "foo"', () => {
    expect(() =>
      subscribeChannel({
        channelName: `messages:foo`,
        validateUuid: 'foo',
        configure: (ch) => ch,
      })
    ).toThrow(/uuid/i)
    expect(channelFactory).not.toHaveBeenCalled()
  })

  it('throws on an empty string', () => {
    expect(() =>
      subscribeChannel({
        channelName: `messages:`,
        validateUuid: '',
        configure: (ch) => ch,
      })
    ).toThrow(/uuid/i)
    expect(channelFactory).not.toHaveBeenCalled()
  })
})

describe('subscribeChannel — single-consumer rule (registry decision recorded in plan)', () => {
  it('throws "duplicate subscriber" when a second subscribe targets the same channelName', () => {
    subscribeChannel({
      channelName: `messages:${VALID_UUID_A}`,
      validateUuid: VALID_UUID_A,
      configure: (ch) => ch,
    })

    expect(() =>
      subscribeChannel({
        channelName: `messages:${VALID_UUID_A}`,
        validateUuid: VALID_UUID_A,
        configure: (ch) => ch,
      })
    ).toThrow(/duplicate/i)

    // Only one underlying channel was ever created
    expect(channelFactory).toHaveBeenCalledTimes(1)
  })

  it('allows two subscribes with different channelNames', () => {
    subscribeChannel({
      channelName: `messages:${VALID_UUID_A}`,
      validateUuid: VALID_UUID_A,
      configure: (ch) => ch,
    })
    subscribeChannel({
      channelName: `messages:${VALID_UUID_B}`,
      validateUuid: VALID_UUID_B,
      configure: (ch) => ch,
    })

    expect(channelFactory).toHaveBeenCalledTimes(2)
  })
})

describe('subscribeChannel — cleanup', () => {
  it('subscribe → unsubscribe calls removeChannel exactly once', () => {
    const handle = subscribeChannel({
      channelName: `messages:${VALID_UUID_A}`,
      validateUuid: VALID_UUID_A,
      configure: (ch) => ch,
    })

    handle.unsubscribe()

    expect(mockSupabase.removeChannel).toHaveBeenCalledTimes(1)
  })

  it('duplicate unsubscribe is idempotent — no second removeChannel call', () => {
    const handle = subscribeChannel({
      channelName: `messages:${VALID_UUID_A}`,
      validateUuid: VALID_UUID_A,
      configure: (ch) => ch,
    })

    handle.unsubscribe()
    handle.unsubscribe()
    handle.unsubscribe()

    expect(mockSupabase.removeChannel).toHaveBeenCalledTimes(1)
  })

  it('subscribe → unsubscribe → second subscribe with same name creates a FRESH channel (no leaked listeners)', () => {
    const handle = subscribeChannel({
      channelName: `messages:${VALID_UUID_A}`,
      validateUuid: VALID_UUID_A,
      configure: (ch) => ch,
    })
    handle.unsubscribe()

    subscribeChannel({
      channelName: `messages:${VALID_UUID_A}`,
      validateUuid: VALID_UUID_A,
      configure: (ch) => ch,
    })

    expect(channelFactory).toHaveBeenCalledTimes(2)
  })
})

describe('subscribeChannel — test-helper isolation', () => {
  it('__resetRegistryForTests clears the map without throwing', () => {
    subscribeChannel({
      channelName: `messages:${VALID_UUID_A}`,
      validateUuid: VALID_UUID_A,
      configure: (ch) => ch,
    })

    expect(() => __resetRegistryForTests()).not.toThrow()

    // After reset, the same channelName subscribe creates a fresh channel
    subscribeChannel({
      channelName: `messages:${VALID_UUID_A}`,
      validateUuid: VALID_UUID_A,
      configure: (ch) => ch,
    })
    expect(channelFactory).toHaveBeenCalledTimes(2)
  })

  it('a late unsubscribe call after registry reset is a no-op (cleanup-guard pattern)', () => {
    const handle = subscribeChannel({
      channelName: `messages:${VALID_UUID_A}`,
      validateUuid: VALID_UUID_A,
      configure: (ch) => ch,
    })

    __resetRegistryForTests()

    expect(() => handle.unsubscribe()).not.toThrow()
  })
})
