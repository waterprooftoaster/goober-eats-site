'use server'

/**
 * @file actions.ts
 * @description Server actions for authentication: unified authenticate flow,
 *   sign-out, onboarding completion, and account deletion.
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

type ActionState =
  | { error: string }
  | { needsOnboarding: true; email: string }
  | { checkEmail: true; email: string }
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
 * Unified sign-in/sign-up server action; distinguishes mode by presence of confirm_password field.
 * @param _prevState - Previous action state (unused)
 * @param formData - Form data; includes confirm_password only during sign-up
 * @returns Error state, needsOnboarding state, or redirects to / on success
 * @called-by app/auth/login/login-form.tsx
 */
export async function authenticate(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const rawNext = formData.get('next') as string | null
  // Only accept relative paths to prevent open-redirect via crafted form submissions.
  const safeNext = rawNext && rawNext.startsWith('/') ? rawNext : null
  const rawConfirm = formData.get('confirm_password')
  // Distinguish sign-up (field present in DOM) from sign-in (field absent).
  // formData.get returns null when the field isn't rendered at all.
  const isSignUp = rawConfirm !== null && rawConfirm !== undefined
  const confirmPassword = rawConfirm as string

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

  if (isSignUp) {
    // Sign-up flow
    if (password.length < 6) {
      return { error: 'Password must be at least 6 characters.' }
    }
    if (!confirmPassword || confirmPassword !== password) {
      return { error: 'Passwords do not match.' }
    }

    const fullName = (formData.get('full_name') as string)?.trim()
    const schoolId = formData.get('school_id') as string | null

    if (!fullName || fullName.length < 1 || fullName.length > 100) {
      return { error: 'Full name must be between 1 and 100 characters.' }
    }
    if (!schoolId) {
      return { error: 'Please select your school.' }
    }

    const siteUrl = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'
    // If the user came from a "next" intent (e.g. swiper banner), encode it so
    // the confirmation link carries it through: callback → /auth/login?next=X → X.
    const loginDest = safeNext ? `/auth/login?next=${encodeURIComponent(safeNext)}` : '/auth/login'
    const emailRedirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(loginDest)}`
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo, data: { full_name: fullName, school_id: schoolId } },
    })
    if (error) {
      return { error: 'Could not create account. Please try again.' }
    }

    // With email confirmation enabled (config.toml: enable_confirmations = true)
    // signUp returns no session — surface a "check your email" panel and stop here.
    if (!data.session) {
      return { checkEmail: true, email: data.user?.email ?? email }
    }

    // Confirmation disabled fallback (kept for safety): persist the session
    // explicitly to guard against SSR cookie adapter timing.
    await supabase.auth.setSession(data.session)

    // New user always needs onboarding — no profile can exist yet
    return { needsOnboarding: true, email: data.user?.email ?? email }
  }

  // Sign-in flow
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
