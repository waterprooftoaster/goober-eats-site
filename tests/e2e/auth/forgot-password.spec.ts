/**
 * @file forgot-password.spec.ts
 * @description End-to-end coverage for the forgot-password flow:
 *   request a reset link from /auth/forgot-password, fetch the message
 *   from the local Mailpit REST API, click the recovery link to land
 *   on /auth/reset-password, set a new password, and sign back in.
 *   Called by: Playwright test runner
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const TEST_EMAIL = 'forgot-password-test@goobereats.edu'
const ORIGINAL_PASSWORD = 'oldpassword123'
const NEW_PASSWORD = 'newpassword456'
const MAILPIT_BASE = 'http://127.0.0.1:54384'

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

    // Drain the Mailpit mailbox so the most-recent fetched message is the
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

  test('request reset → click email link → set new password → sign in', async ({ page }) => {
    test.setTimeout(60000)

    // 1. Request a reset link from the forgot-password page.
    await page.goto('/auth/forgot-password')
    await page.getByTestId('forgot-password-email-input').fill(TEST_EMAIL)
    await page.getByTestId('forgot-password-submit-button').click()
    await expect(page.getByTestId('forgot-password-sent')).toBeVisible({ timeout: 10000 })

    // 2. Pull the recovery link from Mailpit. Supabase's default recovery
    //    template embeds the /auth/v1/verify URL; we follow it via the API
    //    rather than the rendered Mailpit UI so we can scrape the body.
    const recoveryUrl = await fetchRecoveryLink(TEST_EMAIL)

    // 3. Visit the recovery URL — Supabase verifies the token then redirects
    //    to the configured site_url + the next param (i.e. /auth/reset-password
    //    via /auth/callback). The browser follows the chain and lands on the
    //    new-password form.
    await page.goto(recoveryUrl)
    await expect(page.getByTestId('reset-password-input')).toBeVisible({ timeout: 15000 })

    // 4. Set the new password.
    await page.getByTestId('reset-password-input').fill(NEW_PASSWORD)
    await page.getByTestId('reset-password-submit-button').click()

    // 5. Hard-redirected to /auth/login on success.
    await page.waitForURL('**/auth/login', { timeout: 15000 })

    // The recovery session is still attached to the browser context after
    // updateUser, so /auth/login would auto-skip into onboarding-resume. To
    // prove the *new password* actually works, drop the cookies and go
    // through sign-in as a fresh anonymous visitor.
    await page.context().clearCookies()
    await page.goto('/auth/login')

    // 6. Sign in with the new password.
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
 * Polls the Mailpit REST API for the most-recent message addressed to
 * `email` and extracts the first https?://…/auth URL it finds.
 * @param email - The recipient address to look for
 * @returns The recovery link present in the message body
 * @called-by the forgot-password spec above
 */
async function fetchRecoveryLink(email: string): Promise<string> {
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
          // Prefer text/plain so we don't have to unescape &amp; in URLs.
          const body = detail.Text ?? detail.HTML ?? ''
          const urlMatch = body.match(/https?:\/\/[^\s"<>)]+\/auth[^\s"<>)]+/)
          if (urlMatch) {
            return urlMatch[0].replace(/&amp;/g, '&')
          }
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error(`No recovery email arrived in Mailpit for ${email}`)
}
