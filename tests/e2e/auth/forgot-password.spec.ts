/**
 * @file forgot-password.spec.ts
 * @description End-to-end coverage for the forgot-password OTP flow:
 *   request a reset code from /auth/forgot-password, fetch the latest
 *   message body from the local Inbucket REST API, scrape the 6-digit
 *   token, type it into the OTP input, set a new password on the
 *   /auth/reset-password page, then sign back in.
 *   Called by: Playwright test runner
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const TEST_EMAIL = 'forgot-password-test@goobereats.edu'
const ORIGINAL_PASSWORD = 'oldpassword123'
const NEW_PASSWORD = 'newpassword456'
const MAILPIT_BASE = process.env.MAILPIT_BASE ?? 'http://127.0.0.1:64364'

test.describe('Forgot-password flow', () => {
  test.beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SECRET_KEY!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Idempotent: drop any prior run before reseeding the user.
    const { data: existing } = await supabase.auth.admin.listUsers()
    const prior = existing?.users?.find((u) => u.email === TEST_EMAIL)
    if (prior) {
      await supabase.from('profiles').delete().eq('id', prior.id)
      await supabase.auth.admin.deleteUser(prior.id)
    }

    // Pre-confirm so we can sign in with the *new* password at the end.
    const { error } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: ORIGINAL_PASSWORD,
      email_confirm: true,
    })
    if (error) {
      throw new Error(`Failed to seed test user: ${error.message}`)
    }

    // Drain the mailbox so the most-recent fetched message is the
    // recovery email this test triggers, not stale leftovers.
    await fetch(`${MAILPIT_BASE}/api/v1/messages`, { method: 'DELETE' }).catch(
      () => undefined,
    )
  })

  test.afterAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SECRET_KEY!
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: users } = await supabase.auth.admin.listUsers()
    const user = users?.users?.find((u) => u.email === TEST_EMAIL)
    if (user) {
      await supabase.from('profiles').delete().eq('id', user.id)
      await supabase.auth.admin.deleteUser(user.id)
    }
  })

  test('request reset → enter OTP → set new password → sign in', async ({ page }) => {
    test.setTimeout(60000)

    // 1. Request a reset code from the forgot-password page.
    await page.goto('/auth/forgot-password')
    await page.getByTestId('forgot-password-email-input').fill(TEST_EMAIL)
    await page.getByTestId('forgot-password-submit-button').click()
    await expect(page.getByTestId('forgot-password-sent')).toBeVisible({ timeout: 10000 })

    // 2. Pull the recovery code from the test mailbox. The new template
    //    renders {{ .Token }} as a plain 6-digit string in the body.
    const token = await fetchOtpToken(TEST_EMAIL)

    // 3. Type the OTP into the same tab — no link to click, no Tab B.
    await page.getByTestId('forgot-password-otp-input').fill(token)
    await page.getByTestId('forgot-password-verify-button').click()

    // 4. The form hard-loads /auth/reset-password once the recovery
    //    session is established.
    await page.waitForURL('**/auth/reset-password', { timeout: 15000 })
    await expect(page.getByTestId('reset-password-input')).toBeVisible({ timeout: 15000 })

    // 5. Set the new password.
    await page.getByTestId('reset-password-input').fill(NEW_PASSWORD)
    await page.getByTestId('reset-password-submit-button').click()

    // 6. Hard-redirected to /auth/login on success.
    await page.waitForURL('**/auth/login', { timeout: 15000 })

    // The recovery session is still attached to the browser context after
    // updateUser, so /auth/login would auto-skip into onboarding-resume. To
    // prove the *new password* actually works, drop the cookies and go
    // through sign-in as a fresh anonymous visitor.
    await page.context().clearCookies()
    await page.goto('/auth/login')

    // 7. Sign in with the new password.
    await page.getByTestId('auth-email-input').fill(TEST_EMAIL)
    await page.getByTestId('auth-continue-button').click()
    await page.getByTestId('auth-password-input').fill(NEW_PASSWORD)
    await page.getByTestId('auth-signin-button').click()

    // We deliberately did NOT create a profiles row — the sign-in flow will
    // detect the missing profile and surface the onboarding step. That's the
    // signal the new password worked: we cleared the password gate.
    await expect(page.getByTestId('auth-fullname-input')).toBeVisible({ timeout: 15000 })
  })
})

// --- Helpers ---

/**
 * Polls the local Inbucket/Mailpit REST API for the most-recent message
 * addressed to `email` and extracts the 6-digit OTP from its body.
 * @param email - The recipient address to look for
 * @returns The 6-digit numeric token rendered by the recovery template
 * @called-by the forgot-password spec above
 */
async function fetchOtpToken(email: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const listRes = await fetch(`${MAILPIT_BASE}/api/v1/messages`)
    if (listRes.ok) {
      const list = (await listRes.json()) as {
        messages?: Array<{ ID: string; To?: Array<{ Address: string }> }>
      }
      const match = list.messages?.find(
        (m) => m.To?.some((t) => t.Address.toLowerCase() === email.toLowerCase()),
      )
      if (match) {
        const detailRes = await fetch(`${MAILPIT_BASE}/api/v1/message/${match.ID}`)
        if (detailRes.ok) {
          const detail = (await detailRes.json()) as { Text?: string; HTML?: string }
          const body = detail.Text ?? detail.HTML ?? ''
          // Look for the first standalone 6-digit run; the template
          // renders the token in its own paragraph so this is unambiguous.
          const tokenMatch = body.match(/\b(\d{6})\b/)
          if (tokenMatch) {
            return tokenMatch[1]
          }
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error(`No recovery email arrived in mailbox for ${email}`)
}
