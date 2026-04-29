/**
 * @file seed.ts
 * @description Seeds the Supabase database for the GrubHub-cart-screenshot
 *   model: schools (NYU + The New School), demo profiles for orderer/swiper
 *   roles in each school, Stripe Connect onboarding rows for both swipers,
 *   and one open NYU "Chipotle" demo order with two placeholder PNG
 *   screenshots in the cart-screenshots bucket. Idempotent — safe to re-run.
 *   Called by: npx tsx scripts/seed.ts
 * @dependencies @supabase/supabase-js
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { randomBytes, randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { computeSplit } from '../lib/pricing'

// ---------------------------------------------------------------------------
// Bootstrap env
// ---------------------------------------------------------------------------

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
  // .env.local not found — assume env vars are already exported.
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface SchoolSpec {
  slug: string
  name: string
}

interface DemoUserSpec {
  email: string
  fullName: string
  schoolSlug: 'nyu' | 'tns'
  isSwiper: boolean
}

const SCHOOLS: SchoolSpec[] = [
  { slug: 'nyu', name: 'New York University' },
  { slug: 'tns', name: 'The New School' },
]

const DEMO_PASSWORD = 'goober123'

const DEMO_USERS: DemoUserSpec[] = [
  { email: 'nyuuser@test.edu', fullName: 'NYU User', schoolSlug: 'nyu', isSwiper: false },
  { email: 'nyuswiper@test.edu', fullName: 'NYU Swiper', schoolSlug: 'nyu', isSwiper: true },
  { email: 'tnsuser@test.edu', fullName: 'TNS User', schoolSlug: 'tns', isSwiper: false },
  { email: 'tnsswiper@test.edu', fullName: 'TNS Swiper', schoolSlug: 'tns', isSwiper: true },
]

// 1×1 PNG (smallest valid PNG payload — placeholder for the demo order).
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
  'base64'
)

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Seeds schools, demo users, stripe_accounts, and one open NYU demo order
 * with placeholder screenshots. Idempotent.
 * @returns Resolves when seed completes; logs a summary
 */
async function main(): Promise<void> {
  const schoolsOnly = process.env.SEED_SCHOOLS_ONLY === '1'

  console.log('Seeding schools…')
  const schoolIds = await seedSchools()

  if (schoolsOnly) {
    console.log('SEED_SCHOOLS_ONLY=1 — skipping demo users, stripe_accounts, demo order.')
    console.log('Seed complete.')
    console.log(`  - Schools: ${SCHOOLS.map((s) => s.slug).join(', ')}`)
    return
  }

  console.log('Seeding demo users + profiles…')
  const userIds = await seedUsers(schoolIds)

  console.log('Seeding stripe_accounts for swipers…')
  await seedStripeAccounts(userIds)

  console.log('Seeding demo open NYU order…')
  await seedDemoOrder(schoolIds.nyu, userIds['nyuuser@test.edu'])

  console.log('Seed complete.')
  console.log(`  - Schools: ${SCHOOLS.map((s) => s.slug).join(', ')}`)
  console.log(`  - Users: ${DEMO_USERS.map((u) => u.email).join(', ')}`)
  console.log(`  - Demo order: 1 open NYU "Chipotle" order with 2 placeholder screenshots`)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})

// --- Helpers ---

type SchoolIds = { nyu: string; tns: string }

/**
 * Upserts NYU + The New School rows; returns their IDs keyed by slug.
 * @returns Map of school slug → UUID
 */
async function seedSchools(): Promise<SchoolIds> {
  const ids: Partial<SchoolIds> = {}
  for (const spec of SCHOOLS) {
    const { data, error } = await supabase
      .from('schools')
      .upsert({ slug: spec.slug, name: spec.name }, { onConflict: 'slug' })
      .select('id')
      .single()
    if (error || !data) throw new Error(`Failed to upsert school ${spec.slug}: ${error?.message}`)
    ids[spec.slug as keyof SchoolIds] = data.id
  }
  return ids as SchoolIds
}

/**
 * Creates auth users (idempotent) and upserts their profile rows.
 * @param schoolIds - Map of school slug → UUID from seedSchools
 * @returns Map of email → user UUID
 */
async function seedUsers(schoolIds: SchoolIds): Promise<Record<string, string>> {
  const idsByEmail: Record<string, string> = {}

  for (const spec of DEMO_USERS) {
    const userId = await getOrCreateAuthUser(spec.email, spec.fullName)
    idsByEmail[spec.email] = userId

    // Profiles need to be created/updated separately (no auto-trigger here).
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: spec.fullName,
        email: spec.email,
        school_id: schoolIds[spec.schoolSlug],
        is_swiper: spec.isSwiper,
      })
    if (profileErr) {
      throw new Error(`Failed to upsert profile for ${spec.email}: ${profileErr.message}`)
    }
  }

  return idsByEmail
}

/**
 * Returns the existing auth.users id for the email, creating the user if absent.
 * Tries the admin endpoint first (preferred — bypasses email-domain validation
 * that hosted Supabase enforces, and creates pre-confirmed users). Falls back
 * to the public /auth/v1/signup endpoint for local GoTrue containers that
 * reject the configured service key at admin endpoints (HS256 sb_secret_ vs
 * ES256-only local GoTrue).
 * @param email - Login email for the demo user
 * @param fullName - Display name
 * @returns Auth user UUID
 */
async function getOrCreateAuthUser(email: string, fullName: string): Promise<string> {
  // Fast path: if a profile already exists with this email, reuse its id.
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (existingProfile?.id) return existingProfile.id

  // Preferred: admin createUser. Works on hosted Supabase (which rejects
  // public signups for emails like @test.edu) and on local with HS256
  // service_role JWTs.
  const adminRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    }),
  })
  if (adminRes.ok) {
    const json = (await adminRes.json()) as { id?: string }
    if (json.id) return json.id
  }

  // Fallback path for local GoTrue containers configured to reject sb_secret_
  // HS256 keys at admin endpoints — they still accept them as apikey on the
  // public signup endpoint.
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  if (!anonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY')

  const signupRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: DEMO_PASSWORD,
      data: { full_name: fullName },
    }),
  })
  if (signupRes.ok) {
    const json = (await signupRes.json()) as { user?: { id: string } }
    if (json.user?.id) return json.user.id
  }

  const signinRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  })
  if (!signinRes.ok) {
    const adminBody = await adminRes.text().catch(() => '')
    const signinBody = await signinRes.text()
    throw new Error(
      `auth user create failed for ${email}: admin=${adminBody}; signin=${signinBody}`
    )
  }
  const signinJson = (await signinRes.json()) as { user?: { id: string } }
  if (!signinJson.user?.id) {
    throw new Error(`signin returned no user for ${email}`)
  }
  return signinJson.user.id
}

/**
 * Upserts stripe_accounts rows (onboarding_complete=true) for the swipers.
 * @param userIds - Map of email → user UUID
 */
async function seedStripeAccounts(userIds: Record<string, string>): Promise<void> {
  for (const spec of DEMO_USERS) {
    if (!spec.isSwiper) continue
    const userId = userIds[spec.email]
    const stripeAccountId = `acct_test_${spec.schoolSlug}_${userId.slice(0, 8)}`
    const { error } = await supabase
      .from('stripe_accounts')
      .upsert(
        {
          user_id: userId,
          stripe_account_id: stripeAccountId,
          onboarding_complete: true,
        },
        { onConflict: 'user_id' }
      )
    if (error) {
      throw new Error(`Failed to upsert stripe_account for ${spec.email}: ${error.message}`)
    }
  }
}

/**
 * Uploads two placeholder PNGs and inserts one open NYU "Chipotle" demo order.
 * Idempotent: looks up by deterministic stripe_payment_intent_id and deletes
 * an existing seed order before inserting a fresh copy (so screenshots stay
 * in sync).
 * @param schoolId - NYU school UUID
 * @param ordererId - NYU orderer profile UUID
 */
async function seedDemoOrder(schoolId: string, ordererId: string): Promise<void> {
  const seedPiId = 'pi_seed_demo_chipotle'

  // Drop any prior seed order so screenshot paths stay current.
  await supabase.from('orders').delete().eq('stripe_payment_intent_id', seedPiId)

  const sessionId = randomBytes(8).toString('base64url').slice(0, 10)
  const path1 = `pre-checkout/${sessionId}/${randomUUID()}.png`
  const path2 = `pre-checkout/${sessionId}/${randomUUID()}.png`

  for (const path of [path1, path2]) {
    const { error: uploadErr } = await supabase.storage
      .from('cart-screenshots')
      .upload(path, PLACEHOLDER_PNG, { contentType: 'image/png', upsert: true })
    if (uploadErr) {
      throw new Error(`Failed to upload demo screenshot ${path}: ${uploadErr.message}`)
    }
  }

  // Subtotal $25.00 → orderer pays $15.00, platform $2.50, swiper $12.50.
  const split = computeSplit(2500)

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      orderer_id: ordererId,
      school_id: schoolId,
      restaurant_name: 'Chipotle',
      cart_screenshot_urls: [path1, path2],
      stripe_payment_intent_id: seedPiId,
      subtotal_cents: split.subtotalCents,
      total_cents: split.ordererPaysCents,
      status: 'open',
    })
    .select('id')
    .single()
  if (orderErr || !order) {
    throw new Error(`Failed to insert demo order: ${orderErr?.message}`)
  }

  const { error: paymentErr } = await supabase.from('payments').upsert(
    {
      order_id: order.id,
      stripe_payment_intent_id: seedPiId,
      amount_cents: split.ordererPaysCents,
      platform_fee_cents: split.platformFeeCents,
      status: 'succeeded',
      payer_id: ordererId,
      payee_id: null,
    },
    { onConflict: 'stripe_payment_intent_id' }
  )
  if (paymentErr) {
    throw new Error(`Failed to upsert demo payment: ${paymentErr.message}`)
  }
}
