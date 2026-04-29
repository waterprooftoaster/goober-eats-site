/**
 * @file verify-merged-rls.ts
 * @description Direct RLS verification script for the merged policies on
 *   messages (INSERT, SELECT) and conversations (SELECT). Exercises each
 *   role (authenticated orderer, authenticated swiper, anon orderer, random
 *   third user) and asserts allow/deny matches expectations.
 *   Called by: npx tsx scripts/verify-merged-rls.ts
 * @dependencies @supabase/supabase-js, .env.local pointing at LOCAL Supabase
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { randomUUID } from 'crypto'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface Outcome {
  label: string
  expected: 'allow' | 'deny'
  actual: 'allow' | 'deny'
  detail?: string
}

const failures: Outcome[] = []
const passes: Outcome[] = []

main().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})

// --- Helpers ---

async function main(): Promise<void> {
  bootstrapEnv()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  const serviceKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !anonKey || !serviceKey) {
    throw new Error('Missing required env vars')
  }

  const service = createClient(url, serviceKey)

  console.log('Setting up fresh test fixtures…')
  const fx = await setupFixtures(service, url, anonKey)

  console.log(`  orderer:        ${fx.ordererId}`)
  console.log(`  swiper:         ${fx.swiperId}`)
  console.log(`  third-party:    ${fx.thirdId}`)
  console.log(`  anon orderer:   ${fx.anonId}`)
  console.log(`  guest order:    ${fx.guestOrderId}`)
  console.log(`  guest convo:    ${fx.guestConversationId}`)
  console.log(`  auth order:     ${fx.authOrderId}`)
  console.log(`  auth convo:     ${fx.authConversationId}`)
  console.log('')

  console.log('Running RLS checks…')

  // === conversations SELECT ===
  await check('orderer SELECTs own conversation', 'allow', () =>
    fx.ordererClient.from('conversations').select('id').eq('id', fx.authConversationId).maybeSingle()
  )
  await check('swiper SELECTs own conversation', 'allow', () =>
    fx.swiperClient.from('conversations').select('id').eq('id', fx.authConversationId).maybeSingle()
  )
  await check('anon orderer SELECTs own conversation', 'allow', () =>
    fx.anonClient.from('conversations').select('id').eq('id', fx.guestConversationId).maybeSingle()
  )
  await check('third-party SELECTs auth conversation (deny)', 'deny', () =>
    fx.thirdClient.from('conversations').select('id').eq('id', fx.authConversationId).maybeSingle()
  )
  await check('third-party SELECTs guest conversation (deny)', 'deny', () =>
    fx.thirdClient.from('conversations').select('id').eq('id', fx.guestConversationId).maybeSingle()
  )

  // === messages SELECT ===
  await check('orderer SELECTs auth-conversation messages', 'allow', () =>
    fx.ordererClient.from('messages').select('id').eq('conversation_id', fx.authConversationId)
  )
  await check('swiper SELECTs auth-conversation messages', 'allow', () =>
    fx.swiperClient.from('messages').select('id').eq('conversation_id', fx.authConversationId)
  )
  await check('anon orderer SELECTs guest-conversation messages', 'allow', () =>
    fx.anonClient.from('messages').select('id').eq('conversation_id', fx.guestConversationId)
  )
  await check('swiper SELECTs guest-conversation messages', 'allow', () =>
    fx.swiperClient.from('messages').select('id').eq('conversation_id', fx.guestConversationId)
  )
  await check('third-party SELECTs auth messages (deny)', 'deny', () =>
    fx.thirdClient.from('messages').select('id').eq('conversation_id', fx.authConversationId)
  )
  await check('third-party SELECTs guest messages (deny)', 'deny', () =>
    fx.thirdClient.from('messages').select('id').eq('conversation_id', fx.guestConversationId)
  )

  // === messages INSERT ===
  await check('orderer INSERTs message into auth conversation', 'allow', () =>
    fx.ordererClient.from('messages').insert({
      conversation_id: fx.authConversationId,
      sender_id: fx.ordererId,
      body: 'orderer-msg',
      message_type: 'text',
    }).select('id')
  )
  await check('swiper INSERTs message into auth conversation', 'allow', () =>
    fx.swiperClient.from('messages').insert({
      conversation_id: fx.authConversationId,
      sender_id: fx.swiperId,
      body: 'swiper-auth-msg',
      message_type: 'text',
    }).select('id')
  )
  await check('anon orderer INSERTs message into guest conversation', 'allow', () =>
    fx.anonClient.from('messages').insert({
      conversation_id: fx.guestConversationId,
      sender_id: fx.anonId,
      body: 'anon-msg',
      message_type: 'text',
    }).select('id')
  )
  await check('swiper INSERTs message into guest conversation', 'allow', () =>
    fx.swiperClient.from('messages').insert({
      conversation_id: fx.guestConversationId,
      sender_id: fx.swiperId,
      body: 'swiper-guest-msg',
      message_type: 'text',
    }).select('id')
  )
  await check('third-party INSERTs message into auth conversation (deny)', 'deny', () =>
    fx.thirdClient.from('messages').insert({
      conversation_id: fx.authConversationId,
      sender_id: fx.thirdId,
      body: 'should-fail',
      message_type: 'text',
    }).select('id')
  )
  await check('third-party INSERTs message into guest conversation (deny)', 'deny', () =>
    fx.thirdClient.from('messages').insert({
      conversation_id: fx.guestConversationId,
      sender_id: fx.thirdId,
      body: 'should-fail',
      message_type: 'text',
    }).select('id')
  )
  await check('orderer spoofs sender_id (deny)', 'deny', () =>
    fx.ordererClient.from('messages').insert({
      conversation_id: fx.authConversationId,
      sender_id: fx.swiperId,
      body: 'spoofed-sender',
      message_type: 'text',
    }).select('id')
  )

  console.log('')
  console.log(`Passed: ${passes.length}`)
  console.log(`Failed: ${failures.length}`)
  if (failures.length > 0) {
    console.log('')
    console.log('Failures:')
    for (const f of failures) {
      console.log(`  ✗ ${f.label} — expected ${f.expected}, got ${f.actual}${f.detail ? ` (${f.detail})` : ''}`)
    }
    process.exit(1)
  }
}

interface Fixtures {
  ordererId: string
  swiperId: string
  thirdId: string
  anonId: string
  authOrderId: string
  authConversationId: string
  guestOrderId: string
  guestConversationId: string
  ordererClient: SupabaseClient
  swiperClient: SupabaseClient
  anonClient: SupabaseClient
  thirdClient: SupabaseClient
}

async function setupFixtures(service: SupabaseClient, url: string, anonKey: string): Promise<Fixtures> {
  // Find seeded school + users.
  const { data: school } = await service.from('schools').select('id').eq('slug', 'nyu').single()
  if (!school) throw new Error('NYU school missing — run seed first')

  const { data: orderer } = await service.from('profiles').select('id').eq('email', 'nyuuser@test.edu').single()
  const { data: swiper } = await service.from('profiles').select('id').eq('email', 'nyuswiper@test.edu').single()
  if (!orderer || !swiper) throw new Error('Seeded NYU profiles missing — run seed first')

  // Create a fresh "third party" auth user via public signup (local accepts any email).
  const thirdEmail = `rls-third-${Date.now()}@test.edu`
  const thirdPassword = 'goober123'
  const thirdSignup = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: thirdEmail, password: thirdPassword }),
  })
  const thirdJson = (await thirdSignup.json()) as { user?: { id: string } }
  const thirdId = thirdJson.user?.id
  if (!thirdId) throw new Error('Failed to create third-party user')
  await service.from('profiles').upsert({
    id: thirdId,
    full_name: 'Third Party',
    email: thirdEmail,
    school_id: school.id,
    is_swiper: false,
  })

  // Create an anon Supabase user for the guest path.
  const anonRes = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `rls-anon-${Date.now()}@test.edu`, password: 'goober123' }),
  })
  const anonJson = (await anonRes.json()) as { user?: { id: string }; access_token?: string }
  const anonId = anonJson.user?.id
  if (!anonId) throw new Error('Failed to create anon user')

  // Build authenticated order + conversation (orderer ↔ swiper).
  const authOrder = await service
    .from('orders')
    .insert({
      orderer_id: orderer.id,
      swiper_id: swiper.id,
      school_id: school.id,
      restaurant_name: 'Chipotle',
      cart_screenshot_urls: ['fake/path1.png'],
      total_cents: 1500,
      subtotal_cents: 2500,
      status: 'in_progress',
      stripe_payment_intent_id: `pi_test_auth_${randomUUID()}`,
    })
    .select('id')
    .single()
  if (authOrder.error || !authOrder.data) throw new Error(`auth order: ${authOrder.error?.message}`)

  const authConvo = await service
    .from('conversations')
    .insert({ order_id: authOrder.data.id, orderer_id: orderer.id, swiper_id: swiper.id })
    .select('id')
    .single()
  if (authConvo.error || !authConvo.data) throw new Error(`auth convo: ${authConvo.error?.message}`)

  // Build guest order + conversation (anon ↔ swiper).
  const guestOrder = await service
    .from('orders')
    .insert({
      orderer_id: null,
      swiper_id: swiper.id,
      school_id: school.id,
      restaurant_name: 'Chipotle',
      cart_screenshot_urls: ['fake/path2.png'],
      total_cents: 1500,
      subtotal_cents: 2500,
      status: 'in_progress',
      stripe_payment_intent_id: `pi_test_guest_${randomUUID()}`,
      guest_access_token: randomUUID(),
      anon_user_id: anonId,
      guest_name: 'Guest',
    })
    .select('id')
    .single()
  if (guestOrder.error || !guestOrder.data) throw new Error(`guest order: ${guestOrder.error?.message}`)

  const guestConvo = await service
    .from('conversations')
    .insert({ order_id: guestOrder.data.id, orderer_id: null, swiper_id: swiper.id })
    .select('id')
    .single()
  if (guestConvo.error || !guestConvo.data) throw new Error(`guest convo: ${guestConvo.error?.message}`)

  // Pre-seed one message per conversation so SELECT checks have something to read.
  for (const convoId of [authConvo.data.id, guestConvo.data.id]) {
    const msg = await service
      .from('messages')
      .insert({ conversation_id: convoId, sender_id: swiper.id, body: 'preseed', message_type: 'text' })
    if (msg.error) throw new Error(`preseed message: ${msg.error.message}`)
  }

  // Build user-scoped clients (each authenticated as the role under test).
  const ordererClient = await signedInClient(url, anonKey, 'nyuuser@test.edu', 'goober123')
  const swiperClient = await signedInClient(url, anonKey, 'nyuswiper@test.edu', 'goober123')
  const thirdClient = await signedInClient(url, anonKey, thirdEmail, thirdPassword)
  const anonAccessToken = anonJson.access_token
  if (!anonAccessToken) throw new Error('anon signup did not return access_token')
  const anonClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${anonAccessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return {
    ordererId: orderer.id,
    swiperId: swiper.id,
    thirdId,
    anonId,
    authOrderId: authOrder.data.id,
    authConversationId: authConvo.data.id,
    guestOrderId: guestOrder.data.id,
    guestConversationId: guestConvo.data.id,
    ordererClient,
    swiperClient,
    thirdClient,
    anonClient,
  }
}

async function signedInClient(url: string, anonKey: string, email: string, password: string): Promise<SupabaseClient> {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`signin failed for ${email}: ${await res.text()}`)
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error(`no access_token for ${email}`)
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${json.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function check(
  label: string,
  expected: 'allow' | 'deny',
  fn: () => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>
): Promise<void> {
  const result = await fn()

  // For SELECT: allow = no error, deny = no error but empty result OR an error.
  // For INSERT: allow = no error, deny = error.
  // We unify: if there's an explicit error → deny. If no error and data is non-empty array or non-null object → allow. Empty array/null → deny (RLS filtered out).
  let actual: 'allow' | 'deny'
  let detail: string | undefined
  if (result.error) {
    actual = 'deny'
    detail = `error: ${result.error.message}`
  } else if (Array.isArray(result.data)) {
    actual = result.data.length > 0 ? 'allow' : 'deny'
    detail = `rows=${result.data.length}`
  } else if (result.data === null) {
    actual = 'deny'
    detail = 'null result'
  } else {
    actual = 'allow'
  }

  const outcome: Outcome = { label, expected, actual, detail }
  if (actual === expected) {
    passes.push(outcome)
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(outcome)
    console.log(`  ✗ ${label} — expected ${expected}, got ${actual}${detail ? ` (${detail})` : ''}`)
  }
}

function bootstrapEnv(): void {
  try {
    const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
    for (const line of envFile.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // .env.local missing — assume vars exported.
  }
}
