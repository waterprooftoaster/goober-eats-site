import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SIGNUP_EMAIL = 'signup-test@goobereats.test'
const SIGNUP_PASSWORD = 'signup123456'
const SIGNUP_FULL_NAME = 'Signup User'

test.describe('Authentication flow', () => {
  // Create test user via admin API (bypasses email rate limits) and ensure
  // no profile exists so sign-in triggers the onboarding flow.
  test.beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SECRET_KEY!
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data } = await supabase.auth.admin.listUsers()
    const existing = data?.users?.find((u) => u.email === SIGNUP_EMAIL)

    if (existing) {
      // Delete profile so sign-in triggers onboarding
      await supabase.from('profiles').delete().eq('id', existing.id)
    } else {
      // Create the user via admin API so no email is sent (avoids rate limits)
      await supabase.auth.admin.createUser({
        email: SIGNUP_EMAIL,
        password: SIGNUP_PASSWORD,
        email_confirm: true,
      })
    }
  })

  test('sign in, onboard, sign out, sign in again', async ({ page }) => {
    test.setTimeout(60000)

    // --- Sign In (triggers onboarding since profile is missing) ---
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')

    // Step 1: Enter email
    await page.getByPlaceholder('Enter your email').fill(SIGNUP_EMAIL)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    // Step 2: Enter password (user exists in auth → single password field, sign-in mode)
    await page.getByPlaceholder('Password', { exact: true }).fill(SIGNUP_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()

    // Step 3: Onboarding — server action detects missing profile and returns needsOnboarding
    await expect(page.getByText('What should we call you?')).toBeVisible({ timeout: 15000 })
    await page.getByPlaceholder('Enter your full name').fill(SIGNUP_FULL_NAME)

    // Select a school (now required) — type to filter, arrow down to highlight, Enter to select
    const schoolInput = page.getByPlaceholder('Search schools...')
    await schoolInput.fill('NYU')
    await schoolInput.press('ArrowDown')
    await schoolInput.press('Enter')

    // Verify a school was selected (hidden input should have a value)
    await expect(page.locator('input[name="school_id"]')).not.toHaveValue('')

    await page.getByRole('button', { name: 'Get Started' }).click()

    // Should redirect to homepage
    await page.waitForURL('/', { timeout: 15000 })
    await expect(page.locator('[data-testid="eatery-card"]').first()).toBeVisible()

    // --- Sign Out ---
    await page.goto('/account')
    await expect(page.getByText(SIGNUP_EMAIL)).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Sign Out' }).click()
    await page.waitForURL('/', { timeout: 15000 })

    // --- Sign In again (profile now exists, goes straight to homepage) ---
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')

    // Step 1: Enter email
    await page.getByPlaceholder('Enter your email').fill(SIGNUP_EMAIL)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    // Step 2: Enter password (existing user = sign-in mode)
    await page.getByPlaceholder('Password', { exact: true }).fill(SIGNUP_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()

    // Should redirect to homepage
    await page.waitForURL('/', { timeout: 15000 })
  })
})

const FORM_SIGNUP_EMAIL = 'signup-via-form@goobereats.test'
const FORM_SIGNUP_PASSWORD = 'form123456'

test.describe('Signup via form', () => {
  let insertedSchoolId: string | null = null

  test.beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SECRET_KEY!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Clean up any previous run of this test
    const { data: users } = await supabase.auth.admin.listUsers()
    const existing = users?.users?.find((u) => u.email === FORM_SIGNUP_EMAIL)
    if (existing) {
      await supabase.from('profiles').delete().eq('id', existing.id)
      await supabase.auth.admin.deleteUser(existing.id)
    }

    // Ensure at least one school exists for the combobox test
    const { data: schools } = await supabase.from('schools').select('id').limit(1)
    if (!schools || schools.length === 0) {
      const { data: inserted } = await supabase
        .from('schools')
        .insert({ name: 'Test University' })
        .select('id')
        .single()
      insertedSchoolId = inserted?.id ?? null
    }
  })

  test.afterAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SECRET_KEY!
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: users } = await supabase.auth.admin.listUsers()
    const user = users?.users?.find((u) => u.email === FORM_SIGNUP_EMAIL)
    if (user) {
      await supabase.from('profiles').delete().eq('id', user.id)
      await supabase.auth.admin.deleteUser(user.id)
    }

    if (insertedSchoolId) {
      await supabase.from('schools').delete().eq('id', insertedSchoolId)
    }
  })

  test('signup with full name, Enter-to-select school, onboarding completes', async ({
    page,
  }) => {
    test.setTimeout(60000)

    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')

    // Step 1: Enter email
    await page.getByPlaceholder('Enter your email').fill(FORM_SIGNUP_EMAIL)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    // Step 2: Fill both password fields (new user → sign-up mode with two fields)
    await page.getByPlaceholder('Password', { exact: true }).fill(FORM_SIGNUP_PASSWORD)
    await page.getByPlaceholder('Confirm Password').fill(FORM_SIGNUP_PASSWORD)
    await page.getByRole('button', { name: 'Sign Up' }).click()

    // Step 3: Onboarding — full name with spaces
    await expect(page.getByText('What should we call you?')).toBeVisible({ timeout: 15000 })
    await page.getByPlaceholder('Enter your full name').fill('Jane Doe')

    // Enter-to-select in school combobox: type to filter, arrow down to highlight, Enter to select
    const schoolInput = page.getByPlaceholder('Search schools...')
    await schoolInput.fill('NYU')
    await schoolInput.press('ArrowDown')
    await schoolInput.press('Enter')

    // Verify a school was selected (hidden input should have a value)
    await expect(page.locator('input[name="school_id"]')).not.toHaveValue('')

    // Submit onboarding
    await page.getByRole('button', { name: 'Get Started' }).click()

    // Should redirect to homepage — no "Not authenticated" error
    await page.waitForURL('/', { timeout: 15000 })
    await expect(page.locator('[data-testid="eatery-card"]').first()).toBeVisible()
  })
})
