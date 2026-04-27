# `/stripe/onboard/complete` — Craft

## Anatomy

```
async function StripeOnboardCompletePage() {
  // 1. Auth gate
  if (!user) redirect('/auth/login')

  // 2. Stripe row lookup (user-client; RLS allows owner read)
  const { data: stripeRow } = await supabase
    .from('stripe_accounts')
    .select('stripe_account_id, onboarding_complete')
    .eq('user_id', user.id)
    .maybeSingle()

  // 3. Webhook-race fallback: sync Stripe → DB via service client
  const serviceClient = createServiceClient()
  if (stripeRow && !onboardingComplete) {
    try {
      const account = await getStripe().accounts.retrieve(...)
      if (account.details_submitted && account.charges_enabled) {
        await serviceClient.from('stripe_accounts')
          .update({ onboarding_complete: true })
          .eq('stripe_account_id', stripeRow.stripe_account_id)
        onboardingComplete = true
      }
    } catch { /* non-fatal */ }
  }

  // 4. Activate swiper if both conditions met
  if (onboardingComplete) {
    const { data: profile } = await supabase.from('profiles')
      .select('school_id, is_swiper').eq('id', user.id).single()

    if (profile?.school_id && !profile.is_swiper) {
      await serviceClient.from('profiles')
        .update({ is_swiper: true })
        .eq('id', user.id).eq('is_swiper', false)  ← atomic
    }

    if (profile?.school_id) redirect('/?notice=swiper_activated')
  }

  // 5. Fallback render
  return (
    <main data-testid="onboard-almost-there-page" max-w-md py-16 px-6>
      <Surface tone="subtle" padding="lg">
        <header>
          <h1 text-3xl/4xl semibold tracking-tight />  ← "Almost there."
          <p text-sm text-muted-foreground />
        </header>
        <Button variant="primary" asChild>
          <Link href="/swiper-registration">Back to swiper registration</Link>
        </Button>
      </Surface>
    </main>
  )
}
```

## Decisions

- **Webhook-race sync preserved verbatim.** The Stripe SDK direct
  read + service-client DB update is the load-bearing piece; do not
  touch.
- **Atomic compare-and-set preserved.** `eq('id', userId).eq('is_swiper', false)` ensures double-loading the page never double-activates.
- **Explicit school-missing guard added.** S01 had a subtle bug: if
  `onboarding_complete=true` AND `school_id=null`, the code reached
  `redirect('/?notice=swiper_activated')` regardless. The redesign
  guards `if (profile?.school_id) redirect(...)` so the
  school-missing case correctly falls through to the "Almost there"
  fallback, matching catalog SWIP-ONBOARD-ALMOST-THERE intent
  (`onboarding incomplete OR school not set`). Behavioral change is
  small but correctness-aligned: a swiper without a school in S01
  would land home with a "you're activated" notice and then bounce
  out of /swiper/orders due to the layout gate. The redesign sends
  them back to /swiper-registration to finish.
- **`<Surface tone="subtle" padding="lg">`** instead of bare `<div>`
  wrapper for the fallback. Brand consistency with /checkout +
  /swiper/orders error.tsx.
- **`<Button variant="primary" asChild>` + `<Link>`** for the
  fallback CTA. Same pattern as the Become-Swiper CTA in
  /account.
- **`console.log` removed** (debug breadcrumb, not feature behavior).
  `console.error` removed (was unused — `profileError` was caught but
  never gated behavior).
- **JSDoc header updated** to reflect the new dependencies (Button,
  Surface).

## Behavior preserved

- Auth gate: `redirect('/auth/login')` if no user.
- Stripe row lookup via user client; falls through to fallback if
  null.
- Webhook-race try/catch is non-fatal — swallowed errors leave
  `onboardingComplete` at its current value.
- Service-client write happens after Stripe SDK confirms.
- Atomic compare-and-set on `is_swiper`.
- Redirect target `/?notice=swiper_activated`.
- "Almost there" fallback links to `/swiper-registration`.

## Testid coverage

`onboard-almost-there-page` survives on `<main>`.

## A11y

- Single `<main>` landmark.
- `<h1>` heading rhythm.
- `<Button asChild>` wraps a real `<Link>` so keyboard activation +
  focus-visible rings work via primitive defaults.
- Fallback surface is high-contrast tinted-neutral; no decorative
  chrome.

## File hygiene

- `page.tsx`: 92 LOC (was 95). +6 LOC for Surface/Button + the
  school-missing guard; -9 LOC from removing console.log/error and
  consolidating the tail.
- `error.tsx` (new): 65 LOC.
- JSDoc headers, default-export-first, helpers below `// --- Helpers ---`
  separator (`error.tsx`'s `sanitize` is the only helper).

## Vitest specs

NONE — server-only resolver; mocking Stripe + Supabase + redirect is
high-effort low-yield. Coverage via manual smoke + E2E + error.tsx.
Documented in shape.md and in SESSION_LOG.
