/**
 * @file auth.setup.ts
 * @description Playwright global setup that creates a test user in Supabase and writes
 *   browser auth state to .auth/user.json for the authenticated test project.
 *   Called by: Playwright "authenticated" project (playwright.config.ts)
 */

import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const TEST_EMAIL = 'test@goobereats.edu'
const TEST_PASSWORD = 'testpassword123'
const TEST_FULL_NAME = 'Test User'

setup('create test user and authenticate', async ({ page }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SECRET_KEY!
  const supabase = createClient(supabaseUrl, serviceKey)

  // Delete existing test user if present (idempotent setup)
  const { data: existing } = await supabase.auth.admin.listUsers()
  const existingUser = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (existingUser) {
    await supabase.from('profiles').delete().eq('id', existingUser.id)
    await supabase.auth.admin.deleteUser(existingUser.id)
  }

  // Create test user via admin API (auto-confirmed)
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (createError || !created.user) {
    throw new Error(`Failed to create test user: ${createError?.message}`)
  }

  // Ensure at least one school exists for the profile
  const { data: schools } = await supabase.from('schools').select('id').limit(1)
  const schoolId = schools?.[0]?.id ?? null

  // Create profile for the user
  const { error: profileError } = await supabase.from('profiles').insert({
    id: created.user.id,
    full_name: TEST_FULL_NAME,
    email: TEST_EMAIL,
    school_id: schoolId,
  })
  if (profileError) {
    throw new Error(`Failed to create profile: ${profileError.message}`)
  }

  // Sign in via the login page
  await page.goto('/auth/login')

  // Step 1: Enter email
  await page.getByTestId('auth-email-input').fill(TEST_EMAIL)
  await page.getByTestId('auth-continue-button').click()

  // Step 2: Enter password (existing user = single password field, sign-in mode)
  await page.getByTestId('auth-password-input').fill(TEST_PASSWORD)
  await page.getByTestId('auth-signin-button').click()

  // Wait for redirect to homepage
  await page.waitForURL('/', { timeout: 10000 })

  // Save auth state
  await page.context().storageState({ path: '.auth/user.json' })
})
