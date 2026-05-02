/**
 * @file auth.setup.ts
 * @description Playwright global setup that creates two test users in the *test* Supabase
 *   (an orderer and a swiper with a real Stripe Connect Express account) and writes
 *   storage states for both. Targets the test DB exclusively — never touches the dev
 *   Supabase. Both downstream Playwright projects (`authenticated`, `live-money`)
 *   depend on this.
 *   Called by: Playwright "authenticated" + "live-money" projects (playwright.config.ts)
 * @dependencies @supabase/supabase-js, scripts/lib/stripe-seed.ts
 */

import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { getOrCreateSeededStripeAccount, assertStripeTestMode } from '../../scripts/lib/stripe-seed'

const ORDERER_EMAIL = 'orderer@goobereats.edu'
const ORDERER_PASSWORD = 'testpassword123'
const ORDERER_FULL_NAME = 'Test Orderer'

const SWIPER_EMAIL = 'swiper@goobereats.edu'
const SWIPER_PASSWORD = 'testpassword123'
const SWIPER_FULL_NAME = 'Test Swiper'

setup('create orderer', async ({ page }) => {
  const supabase = buildTestAdminClient()
  const schoolId = await ensureSchoolId(supabase)
  const userId = await idempotentlyCreateUser(supabase, ORDERER_EMAIL, ORDERER_PASSWORD)
  await upsertProfile(supabase, {
    id: userId,
    full_name: ORDERER_FULL_NAME,
    email: ORDERER_EMAIL,
    school_id: schoolId,
    is_swiper: false,
  })
  await signInAndSaveState(page, ORDERER_EMAIL, ORDERER_PASSWORD, '.auth/orderer.json')
})

setup('create swiper with stripe connect', async ({ page }) => {
  const supabase = buildTestAdminClient()
  const schoolId = await ensureSchoolId(supabase)
  const userId = await idempotentlyCreateUser(supabase, SWIPER_EMAIL, SWIPER_PASSWORD)
  await upsertProfile(supabase, {
    id: userId,
    full_name: SWIPER_FULL_NAME,
    email: SWIPER_EMAIL,
    school_id: schoolId,
    is_swiper: true,
  })

  // Attach a real Stripe Connect Express account so transfers settle in test mode.
  // Stripe access requires test mode — guard against accidental live-key seeding.
  if (process.env.STRIPE_SECRET_KEY) {
    assertStripeTestMode()
    const acctId = await getOrCreateSeededStripeAccount(userId, SWIPER_EMAIL)
    await supabase.from('stripe_accounts').upsert(
      {
        user_id: userId,
        stripe_account_id: acctId,
        onboarding_complete: true,
      },
      { onConflict: 'user_id' }
    )
  }

  await signInAndSaveState(page, SWIPER_EMAIL, SWIPER_PASSWORD, '.auth/swiper.json')
})

// --- Helpers ---

function buildTestAdminClient() {
  const url = process.env.TEST_SUPABASE_URL
  const key = process.env.TEST_SUPABASE_SECRET_KEY
  if (!url || !key) {
    throw new Error(
      'TEST_SUPABASE_URL / TEST_SUPABASE_SECRET_KEY not set — run `cp .env.test.example .env.test` and fill in values from `npx supabase status --workdir supabase-test`'
    )
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function ensureSchoolId(supabase: ReturnType<typeof buildTestAdminClient>): Promise<string> {
  const { data: existing } = await supabase.from('schools').select('id').limit(1)
  if (existing?.[0]?.id) return existing[0].id

  // Insert a placeholder school for fresh test DBs that lack seed data
  const { data: created, error } = await supabase
    .from('schools')
    .insert({ name: 'Test University', slug: 'test-u' })
    .select('id')
    .single()
  if (error || !created) {
    throw new Error(`Failed to seed test school: ${error?.message ?? 'no row returned'}`)
  }
  return created.id
}

async function idempotentlyCreateUser(
  supabase: ReturnType<typeof buildTestAdminClient>,
  email: string,
  password: string
): Promise<string> {
  const { data: list } = await supabase.auth.admin.listUsers()
  const existing = list?.users?.find((u) => u.email === email)
  if (existing) {
    await supabase.from('profiles').delete().eq('id', existing.id)
    await supabase.from('stripe_accounts').delete().eq('user_id', existing.id)
    await supabase.auth.admin.deleteUser(existing.id)
  }

  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !created.user) {
    throw new Error(`Failed to create test user ${email}: ${error?.message}`)
  }
  return created.user.id
}

interface ProfileRow {
  id: string
  full_name: string
  email: string
  school_id: string
  is_swiper: boolean
}

async function upsertProfile(
  supabase: ReturnType<typeof buildTestAdminClient>,
  row: ProfileRow
): Promise<void> {
  const { error } = await supabase.from('profiles').insert(row)
  if (error) {
    throw new Error(`Failed to insert profile for ${row.email}: ${error.message}`)
  }
}

async function signInAndSaveState(
  page: Parameters<Parameters<typeof setup>[1]>[0]['page'],
  email: string,
  password: string,
  storagePath: string
): Promise<void> {
  await page.goto('/auth/login')
  await page.getByTestId('auth-email-input').fill(email)
  await page.getByTestId('auth-continue-button').click()
  await page.getByTestId('auth-password-input').fill(password)
  await page.getByTestId('auth-signin-button').click()
  await page.waitForURL('/', { timeout: 10000 })
  await page.context().storageState({ path: storagePath })
}
