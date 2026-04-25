/**
 * @file channel-registry.ts
 * @description Ref-counted singleton wrapper around Supabase Realtime channel
 *   subscriptions. Enforces UUID-validated, fail-closed channel names + idempotent
 *   cleanup, per master plan §11 ("Realtime safeguards"). Single-consumer-per-
 *   channelName is the recorded API decision (both real call sites have one
 *   consumer; multi-consumer is theoretical for S07).
 *   Called by: hooks/use-messages.ts, components/chat-panel/chat-panel-provider.tsx
 * @dependencies @supabase/supabase-js (RealtimeChannel type), @/lib/supabase/client
 */

import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export interface RegistryHandle {
  unsubscribe: () => void
}

export interface SubscribeOptions {
  /** Full channel name as it will be passed to `supabase.channel(...)`, e.g. `messages:{uuid}`. */
  channelName: string
  /** UUID embedded inside `channelName`. Validated against the canonical UUID regex; fails closed if malformed. */
  validateUuid: string
  /** Caller-supplied configurator. Receives a fresh channel and must add `.on(...)` listeners; returns the same channel. */
  configure: (channel: RealtimeChannel) => RealtimeChannel
}

/**
 * Subscribes a single consumer to a Supabase Realtime channel via the registry.
 * @param opts - channel name, the UUID inside it, and a configurator that adds .on() listeners
 * @returns a handle whose unsubscribe() is idempotent and safe across registry resets
 * @called-by hooks/use-messages.ts, components/chat-panel/chat-panel-provider.tsx
 */
export function subscribeChannel(opts: SubscribeOptions): RegistryHandle {
  if (!UUID_REGEX.test(opts.validateUuid)) {
    throw new Error(
      `channel-registry: invalid uuid "${opts.validateUuid}" for channel "${opts.channelName}" — refusing to subscribe (master plan §11 fail-closed)`
    )
  }
  if (registry.has(opts.channelName)) {
    throw new Error(
      `channel-registry: duplicate subscriber for "${opts.channelName}" (S07 single-consumer-per-channelName decision; see SCOPE_AMENDMENTS.md note)`
    )
  }

  const supabase = getSupabase()
  const rawChannel = supabase.channel(opts.channelName)
  const configured = opts.configure(rawChannel)
  configured.subscribe()

  registry.set(opts.channelName, { channel: configured, refCount: 1 })

  let released = false
  return {
    unsubscribe() {
      if (released) return
      released = true
      const entry = registry.get(opts.channelName)
      if (!entry) return
      entry.refCount -= 1
      if (entry.refCount <= 0) {
        supabase.removeChannel(entry.channel)
        registry.delete(opts.channelName)
      }
    },
  }
}

/**
 * Test-only helper that clears the registry map and supabase reference.
 * @called-by tests/unit/lib/realtime/channel-registry.test.ts
 */
export function __resetRegistryForTests(): void {
  registry.clear()
  supabaseRef = null
}

// --- Helpers ---

interface RegistryEntry {
  channel: RealtimeChannel
  refCount: number
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const registry = new Map<string, RegistryEntry>()
let supabaseRef: ReturnType<typeof createClient> | null = null

/**
 * Returns a memoized Supabase client. Lazily created so test mocks attach to the
 * single instance the registry uses for both .channel() and removeChannel().
 */
function getSupabase(): ReturnType<typeof createClient> {
  if (!supabaseRef) supabaseRef = createClient()
  return supabaseRef
}
