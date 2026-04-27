/**
 * @file resolve-principal.ts
 * @description Resolves the calling principal (Supabase auth + cookie store) into the
 *   §10 discriminated union used by every auth-aware UI surface. Frontend-only —
 *   never imports lib/supabase/service. Server components/layouts pass `await cookies()`;
 *   API routes do not consume this helper (they validate via lib/api/guest-auth.ts).
 *   Called by: app/auth/login/page.tsx, app/checkout/page.tsx, app/current-orders/page.tsx
 *              (and future Session 06+ surfaces — see master plan §10).
 * @dependencies @supabase/supabase-js, next/headers (consumer-supplied cookie store)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

export type Principal =
  | { kind: 'anon' }
  | { kind: 'authed_orderer'; userId: string; schoolId: string | null }
  | { kind: 'authed_swiper_pre_stripe'; userId: string; schoolId: string | null }
  | { kind: 'authed_swiper'; userId: string; schoolId: string }
  | { kind: 'guest_cookie'; orderId: string; anonUserId: string | null }

const GUEST_COOKIE_PREFIX = 'guest_order_token_'

/**
 * Resolves the calling principal into the §10 discriminated union.
 * @param supabase - server-cookie-bound client (lib/supabase/server.ts::createClient)
 * @param cookieStore - next/headers cookies() result; passed in to keep the helper unit-testable
 * @returns Principal — see master plan §10
 * @called-by app/auth/login/page.tsx + future S06+ auth-aware surfaces
 */
export async function resolvePrincipal(
  supabase: SupabaseClient,
  cookieStore: ReadonlyRequestCookies,
): Promise<Principal> {
  const { data: { user } } = await supabase.auth.getUser()

  // Anonymous user (or no user) → look for a guest_order_token_* cookie.
  if (!user || user.is_anonymous) {
    const guestOrderId = findGuestOrderId(cookieStore)
    if (guestOrderId) {
      return {
        kind: 'guest_cookie',
        orderId: guestOrderId,
        anonUserId: user?.is_anonymous ? user.id : null,
      }
    }
    return { kind: 'anon' }
  }

  // Real auth user → check profile.
  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    // Mid-onboarding (auth user without profile row). The form detects this case
    // directly via its own getUser+profile lookup; treat as anon for principal purposes.
    return { kind: 'anon' }
  }

  const schoolId = (profile as { school_id: string | null }).school_id

  const { data: stripeAccount } = await supabase
    .from('stripe_accounts')
    .select('onboarding_complete')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!stripeAccount) {
    return { kind: 'authed_orderer', userId: user.id, schoolId }
  }

  const onboardingComplete = (stripeAccount as { onboarding_complete: boolean }).onboarding_complete

  // Full swiper variant requires non-null schoolId (master plan §10 type shape).
  // If onboarding is reportedly complete but schoolId is missing, downgrade to pre_stripe.
  if (onboardingComplete && schoolId !== null) {
    return { kind: 'authed_swiper', userId: user.id, schoolId }
  }
  return { kind: 'authed_swiper_pre_stripe', userId: user.id, schoolId }
}

// --- Helpers ---

function findGuestOrderId(cookieStore: ReadonlyRequestCookies): string | null {
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith(GUEST_COOKIE_PREFIX)) {
      return cookie.name.slice(GUEST_COOKIE_PREFIX.length)
    }
  }
  return null
}
