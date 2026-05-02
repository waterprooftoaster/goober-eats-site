/**
 * @file swiper.setup.ts
 * @description Playwright setup that creates a dedicated swiper test user and
 *   writes its auth state to .auth/swiper.json. Runs as the `swiper-setup`
 *   project; the `authenticated-swiper` project depends on it. The orderer
 *   user (auth.setup.ts) remains untouched so orderer-flow specs are isolated.
 *   Called by: Playwright "swiper-setup" project (playwright.config.ts)
 */

import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SWIPER_EMAIL = 'swiper@goobereats.edu'
const SWIPER_PASSWORD = 'swiperpassword123'
const SWIPER_FULL_NAME = 'Swiper Test User'
const SWIPER_STRIPE_ACCOUNT_ID = 'acct_swiper_setup_e2e'

setup('create swiper test user and authenticate', async ({ page }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SECRET_KEY!
  const supabase = createClient(supabaseUrl, serviceKey)

  // Idempotent reset — listUsers() defaults to perPage=50; bump for safety
  // so the existing user lookup still finds it on a busy local DB.
  const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existingUser = existing?.users?.find((u) => u.email === SWIPER_EMAIL)
  if (existingUser) {
    await supabase.from('stripe_accounts').delete().eq('user_id', existingUser.id)
    await supabase.from('profiles').delete().eq('id', existingUser.id)
    await supabase.auth.admin.deleteUser(existingUser.id)
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: SWIPER_EMAIL,
    password: SWIPER_PASSWORD,
    email_confirm: true,
  })
  if (createError || !created.user) {
    throw new Error(`Failed to create swiper test user: ${createError?.message}`)
  }

  // School assignment is required for is_swiper=true (CHECK constraint).
  const { data: schools } = await supabase.from('schools').select('id').limit(1).single()
  if (!schools) throw new Error('No schools found — seed required before swiper setup')

  const { error: profileError } = await supabase.from('profiles').insert({
    id: created.user.id,
    full_name: SWIPER_FULL_NAME,
    email: SWIPER_EMAIL,
    school_id: schools.id,
    is_swiper: true,
  })
  if (profileError) {
    throw new Error(`Failed to create swiper profile: ${profileError.message}`)
  }

  // Stripe Connect onboarding mock — the §10 Principal helper requires this
  // row with onboarding_complete=true to classify the user as authed_swiper.
  const { error: stripeError } = await supabase.from('stripe_accounts').insert({
    user_id: created.user.id,
    stripe_account_id: SWIPER_STRIPE_ACCOUNT_ID,
    onboarding_complete: true,
  })
  if (stripeError) {
    throw new Error(`Failed to create stripe_accounts row: ${stripeError.message}`)
  }

  // Sign in via the login page (mirrors auth.setup.ts).
  await page.goto('/auth/login')
  await page.getByTestId('auth-email-input').fill(SWIPER_EMAIL)
  await page.getByTestId('auth-continue-button').click()
  await page.getByTestId('auth-password-input').fill(SWIPER_PASSWORD)
  await page.getByTestId('auth-signin-button').click()
  await page.waitForURL('/', { timeout: 10000 })

  await page.context().storageState({ path: '.auth/swiper.json' })
})
