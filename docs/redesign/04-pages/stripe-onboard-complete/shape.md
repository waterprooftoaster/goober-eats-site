# `/stripe/onboard/complete` — Shape

## Role + state branches

Server component invoked by Stripe Connect's `returnUrl` after a swiper
completes (or attempts to complete) hosted onboarding. Resolves the
account state directly via the Stripe SDK (because the
`account.updated` webhook is racy — the user is often redirected back
here before the webhook lands), then either:

- **Activates the swiper** (atomic compare-and-set on `is_swiper=false`
  via service client) and `redirect('/?notice=swiper_activated')`.
- **Renders the "Almost there" fallback** when onboarding is
  incomplete OR `profile.school_id` is null. CTA links back to
  `/swiper-registration`.

State branches:
- `unauthenticated` → `redirect('/auth/login')`.
- `no-stripe-row` → falls through to "almost there" (user reached this
  page without a Stripe Connect account record).
- `onboarding-incomplete` → "almost there" fallback.
- `onboarding-complete + school-set` → activate + redirect home.
- `onboarding-complete + school-missing` → "almost there" fallback
  (matches catalog SWIP-ONBOARD-ALMOST-THERE).
- `stripe-sdk-error` → caught by the inner try/catch; rendered
  exception (rare — service-client failure or profile-lookup failure)
  bubbles to the colocated `error.tsx`.

## Brand decisions

- **One lime CTA on the fallback** — "Back to swiper registration"
  uses `<Button variant="primary">`. No second CTA.
- **`<Surface tone="subtle" padding="lg">`** wraps the fallback.
  Brand-correct tinted neutral instead of pure white.
- **Asymmetric, left-aligned** — `max-w-md py-16 px-6 sm:py-24`. The
  Almost there. heading uses the same `text-3xl/4xl semibold
  tracking-tight` rhythm as /swiper-registration so the user feels
  the same surface family.
- **No "loading" UI** — the page is a server component; resolution
  happens before HTML reaches the browser. Either a redirect fires
  or the fallback renders.

## §10 invariants (preserved verbatim)

- **`createServiceClient()` import + atomic compare-and-set** —
  service client is required because `is_swiper` has a REVOKE UPDATE
  FROM authenticated rule; user-client writes silently fail. The
  redesign only consumes the frozen path; never edits it.
- **Stripe SDK direct read** —
  `getStripe().accounts.retrieve(stripeRow.stripe_account_id)` checks
  `details_submitted && charges_enabled` before flipping
  `onboarding_complete`. This absorbs the webhook race exactly as S01
  did.
- **Atomic `eq('id', userId).eq('is_swiper', false)`** on the
  `profiles.update`. Idempotent across multiple loads of this page.
- **Redirect target `/?notice=swiper_activated`** — frontend home
  page expects this query param to render the success notice.
- **School-missing branch falls through to fallback even when
  onboarding is complete** — added explicit guard
  (`if (profile?.school_id) redirect(...)`) so a swiper without a
  school never redirects home with a stale activation; matches the
  catalog SWIP-ONBOARD-ALMOST-THERE state.

## Logging cleanup

The S01 markup had two `console.log` / `console.error` calls. Per
`coding-style.md`, no `console.log` in production code. The redesign
drops the debug `console.log` ("[fallback-api] stripe sync …"); the
`console.error` for profile fetch failure was redundant (the
`profileError` was checked but never used to gate behavior — if the
profile fetch fails, the next `if (profile?.school_id)` short-circuits
and the fallback renders, which is the right outcome). Both removed
without behavioral change.

## Testid coverage

| Catalog ID | testid | Element |
|---|---|---|
| SWIP-ONBOARD-COMPLETE-LOAD | (none) | server resolver — no DOM binding |
| SWIP-ONBOARD-COMPLETE-SUCCESS | (none) | `redirect()` — no DOM binding |
| SWIP-ONBOARD-ALMOST-THERE | `onboard-almost-there-page` | `<main>` of fallback |

## Vitest specs

NONE this session. The page is server-only with no client-side
interactivity. Testing the redirect/fallback branches requires
mocking `next/navigation`, `lib/supabase/server`, `lib/supabase/service`,
and `lib/stripe/client` — high-effort, low-yield. Coverage relies on:
- Manual smoke at session close (one of the 5 happy-path checks).
- E2E `tests/e2e/authenticated/swiper.spec.ts` (already in baseline).
- The new colocated `error.tsx` for crash safety.

Logged in SESSION_LOG.

## error.tsx

Colocated `app/stripe/onboard/complete/error.tsx` per `02-routes.md
§4`. Failure modes warranting a distinct boundary: Stripe SDK
`accounts.retrieve` failure that escapes the inner try/catch (e.g.,
auth error before the .catch runs); service-client write failure;
`.single()` profile lookup throwing on missing row. Surface sanitizes
the error message (strips paths and stack fragments) and exposes
`error.digest`. CTAs: "Try again" (reset) + "Back to registration"
(exit cleanly).
