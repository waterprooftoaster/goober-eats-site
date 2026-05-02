'use server'

/**
 * @file actions.ts
 * @description Server actions for authentication: sign-in (`authenticate`),
 *   sign-up start (`signUpStart`), OTP verification + profile creation
 *   (`verifySignupOtp`), OTP resend, sign-out, onboarding completion (resume
 *   path), and account deletion. Sign-up collects name + school BEFORE the
 *   OTP is sent so OTP is the final step.
 *   Called by: app/auth/login/login-form.tsx, app/account/account-actions.tsx
 * @dependencies lib/supabase/server.ts, lib/auth/resolve-principal.ts, next/headers, next/cache
 */

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { GUEST_COOKIE_PREFIX } from '@/lib/auth/resolve-principal'
import { claimGuestOrders, clearGuestOrderCookies } from '@/lib/auth/claim-guest-orders'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EDU_EMAIL_REGEX = /\.edu$/i
const FULL_NAME_REGEX = /^[A-Za-z\s\-']+$/

type ActionState =
  | { error: string }
  | { needsOnboarding: true; email: string }
  | { otpSent: true; email: string }
  | { success: true }
  | null

/**
 * Signs out the current user and force-clears every auth artifact in the
 * response cookies — Supabase access/refresh tokens AND any guest_order_token_*
 * cookies the resolvePrincipal helper would otherwise treat as a guest
 * session. Uses scope:'global' so the refresh token is revoked at the auth
 * server, defending against stale cookies that might survive the response.
 * @returns { success: true } on success; { error } if Supabase signOut fails.
 *   The client triggers a hard reload to / so all in-memory state (chat
 *   panels, Realtime subs, useState) is replaced along with the document.
 * @called-by app/account/account-actions.tsx
 */
export async function signOut(): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error) {
    console.error('signOut: supabase.auth.signOut failed', error)
    return { error: error.message }
  }

  // The SSR cookie adapter wraps cookieStore.set in a try/catch (lib/supabase/server.ts)
  // that silently swallows write failures. Manually delete every auth-related
  // cookie here so the response we return to the client is unambiguously logged out.
  const cookieStore = await cookies()
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith('sb-') || c.name.startsWith(GUEST_COOKIE_PREFIX)) {
      cookieStore.delete(c.name)
    }
  }

  // Drop the cached RSC tree built for the prior user.
  revalidatePath('/', 'layout')

  return { success: true }
}

/**
 * Sign-in server action. Sign-up has been split into `signUpStart` so the
 * client can collect name + school before triggering the OTP email — making
 * the OTP the very last step of the sign-up flow.
 * @param _prevState - Previous action state (unused)
 * @param formData - Form data with email + password
 * @returns Error state, needsOnboarding state (returning user with no
 *   profile), or success
 * @called-by app/auth/login/login-form.tsx
 */
export async function authenticate(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !EMAIL_REGEX.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }
  if (!EDU_EMAIL_REGEX.test(email)) {
    return { error: 'Please use a school email ending in .edu.' }
  }
  if (!password) {
    return { error: 'Password is required.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: 'Invalid email or password.' }
  }

  // Check if returning user has a profile
  if (data.user) {
    // Suspension gate: Stripe has permanently terminated this swiper's
    // connected account. Force-signout and refuse the sign-in.
    const { data: stripeAccount } = await supabase
      .from('stripe_accounts')
      .select('suspended')
      .eq('user_id', data.user.id)
      .maybeSingle()
    if ((stripeAccount as { suspended?: boolean } | null)?.suspended === true) {
      await supabase.auth.signOut()
      return { error: 'This account has been suspended.' }
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profileError) {
      return { error: 'Could not verify account status. Please try again.' }
    }
    if (!profile) {
      return { needsOnboarding: true, email: data.user.email ?? email }
    }

    // Claim any guest orders the user placed before signing in. Any error is
    // logged inside the helper; we never block the sign-in flow on it (the
    // cookies persist until the next reload, so the claim can retry).
    try {
      const { claimedOrderIds } = await claimGuestOrders(data.user.id)
      await clearGuestOrderCookies(claimedOrderIds)
    } catch (claimError) {
      console.error('authenticate: claimGuestOrders failed', claimError)
    }
  }

  return { success: true }
}

/**
 * Sign-up entry point: validates the full set of onboarding info collected
 * by the client (email, password, name, school), then creates the auth
 * user and triggers the OTP confirmation email. The collected name and
 * school flow back into `verifySignupOtp` via hidden form fields so the
 * profile row is created the moment the OTP is entered — no separate
 * onboarding step is needed in the happy path.
 * @param _prevState - Previous action state (unused; required by useActionState)
 * @param formData - email, password, confirm_password, full_name, school_id
 * @returns otpSent on success; error state on validation/signUp failure
 * @called-by app/auth/login/login-form.tsx
 */
export async function signUpStart(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = ((formData.get('email') as string | null) ?? '').trim()
  const password = (formData.get('password') as string | null) ?? ''
  const confirmPassword = (formData.get('confirm_password') as string | null) ?? ''
  const fullName = ((formData.get('full_name') as string | null) ?? '').trim()
  const schoolId = ((formData.get('school_id') as string | null) ?? '').trim()

  if (!email || !EMAIL_REGEX.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }
  if (!EDU_EMAIL_REGEX.test(email)) {
    return { error: 'Please use a school email ending in .edu.' }
  }
  if (!password || password.length < 6) {
    return { error: 'Password must be at least 6 characters.' }
  }
  if (confirmPassword !== password) {
    return { error: 'Passwords do not match.' }
  }
  if (!fullName || fullName.length > 100 || !FULL_NAME_REGEX.test(fullName)) {
    return { error: 'Full name may only contain letters, spaces, hyphens, and apostrophes.' }
  }
  if (!schoolId) {
    return { error: 'Please select your school.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) {
    console.error('signUpStart: supabase.auth.signUp failed', {
      code: error.code,
      status: error.status,
      message: error.message,
    })
    return { error: 'Could not create account. Please try again.' }
  }

  // Confirmation-disabled fallback: persist the session and create the
  // profile right here, since OTP entry will not happen.
  if (data.session) {
    await supabase.auth.setSession(data.session)
    if (!data.user?.email) {
      return { error: 'Account created but missing email.' }
    }
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: fullName,
      email: data.user.email,
      school_id: schoolId,
    })
    if (profileError) {
      return { error: 'Could not create profile. Please try again.' }
    }
    try {
      const { claimedOrderIds } = await claimGuestOrders(data.user.id)
      await clearGuestOrderCookies(claimedOrderIds)
    } catch (claimError) {
      console.error('signUpStart: claimGuestOrders failed', claimError)
    }
    return { success: true }
  }

  return { otpSent: true, email: data.user?.email ?? email }
}

/**
 * Re-sends the 6-digit signup confirmation code to `email`. The client
 * gates the call behind a 20-second cooldown via ResendCodeButton, but
 * Supabase also enforces `max_frequency` server-side as a backstop.
 * @param email - The address that originally signed up
 * @returns void; logs Supabase failures but does not surface them to the
 *   client (the code may be rate-limited by Supabase, which is harmless).
 * @called-by app/auth/login/login-form.tsx
 */
export async function resendSignupOtp(email: string): Promise<void> {
  const trimmed = email?.trim() ?? ''
  if (!trimmed || !EMAIL_REGEX.test(trimmed)) return
  const supabase = await createClient()
  const { error } = await supabase.auth.resend({ type: 'signup', email: trimmed })
  if (error) {
    console.error('resendSignupOtp: supabase.auth.resend failed', error)
  }
}

/**
 * Verifies the 6-digit OTP from the signup confirmation email and, on
 * success, creates the user's profile row using the name + school the
 * client collected before sending the OTP. This is the final step of the
 * sign-up flow. If the hidden full_name / school_id are missing (e.g. the
 * user reached this step via a stale tab), we fall back to needsOnboarding
 * so the resume path can collect them.
 * @param _prevState - Previous action state (unused; required by useActionState)
 * @param formData - email, token (6 digits), full_name, school_id
 * @returns success on full completion; needsOnboarding when the OTP was
 *   accepted but profile data is missing; error state otherwise
 * @called-by app/auth/login/login-form.tsx
 */
export async function verifySignupOtp(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = ((formData.get('email') as string | null) ?? '').trim()
  const token = ((formData.get('token') as string | null) ?? '').trim()
  const fullName = ((formData.get('full_name') as string | null) ?? '').trim()
  const schoolId = ((formData.get('school_id') as string | null) ?? '').trim()

  if (!email || !EMAIL_REGEX.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }
  if (!/^\d{6}$/.test(token)) {
    return { error: 'Enter the 6-digit code from your email.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })
  if (error || !data.session) {
    return { error: 'Invalid or expired code. Try again or sign up to resend.' }
  }

  // Defensive resume path: if the client lost the collected onboarding
  // data, hand off to the existing inline name/school step.
  const fullNameValid =
    fullName.length > 0 && fullName.length <= 100 && FULL_NAME_REGEX.test(fullName)
  if (!fullNameValid || !schoolId) {
    return { needsOnboarding: true, email: data.user?.email ?? email }
  }

  if (!data.user?.email) {
    return { error: 'Your account does not have an email address.' }
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user.id,
    full_name: fullName,
    email: data.user.email,
    school_id: schoolId,
  })
  if (profileError) {
    return { error: 'Could not create profile. Please try again.' }
  }

  try {
    const { claimedOrderIds } = await claimGuestOrders(data.user.id)
    await clearGuestOrderCookies(claimedOrderIds)
  } catch (claimError) {
    console.error('verifySignupOtp: claimGuestOrders failed', claimError)
  }

  return { success: true }
}

/**
 * Creates the user's profile row with full name and school, completing the onboarding flow.
 * @param _prevState - Previous action state (unused)
 * @param formData - Form data containing full_name and school_id fields
 * @returns Error state on failure; redirects to / on success
 * @called-by app/auth/login/login-form.tsx
 */
export async function completeOnboarding(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const fullName = (formData.get('full_name') as string)?.trim()
  const schoolId = formData.get('school_id') as string | null

  if (!fullName || fullName.length < 1 || fullName.length > 100) {
    return { error: 'Full name must be between 1 and 100 characters.' }
  }
  if (!schoolId) {
    return { error: 'Please select your school.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated.' }
  }

  if (!user.email) {
    return { error: 'Your account does not have an email address.' }
  }

  const { error } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      full_name: fullName,
      email: user.email,
      school_id: schoolId,
    })

  if (error) {
    return { error: 'Could not create profile. Please try again.' }
  }

  // Claim any guest orders the user placed before signing up. The sign-up
  // path of authenticate() does NOT call this — claim runs here, after the
  // user has a fully-formed profile, matching the rest of the system's
  // assumptions. Best-effort: any error is logged but doesn't block the
  // onboarding success.
  try {
    const { claimedOrderIds } = await claimGuestOrders(user.id)
    await clearGuestOrderCookies(claimedOrderIds)
  } catch (claimError) {
    console.error('completeOnboarding: claimGuestOrders failed', claimError)
  }

  return { success: true }
}

/**
 * Permanently deletes the authenticated user's account via the
 * `public.delete_user_account` SECURITY DEFINER RPC (gated on
 * auth.uid() = target_id), then signs out. Bypasses the GoTrue admin
 * endpoint, which the local Supabase container rejects when called with
 * the new sb_secret_ HS256 keys.
 * @returns { success: true } on success; { error } on failure. The client
 *   triggers a hard reload on success.
 * @called-by app/account/account-actions.tsx
 */
export async function deleteAccount(): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated.' }
  }

  const { error } = await supabase.rpc('delete_user_account', { target_id: user.id })

  if (error) {
    console.error('deleteAccount: rpc delete_user_account failed', error)
    return { error: error.message }
  }

  const { error: signOutError } = await supabase.auth.signOut()
  if (signOutError) {
    console.error('deleteAccount: supabase.auth.signOut failed after delete', signOutError)
    // The user row is already gone — client will hard-reload anyway.
  }
  return { success: true }
}
