# `/stripe/onboard/refresh` — Shape

## Role

Stripe Connect onboarding's `refreshUrl` target. Stripe redirects here
when the onboarding session expires before the user completes it
(typical case: user closed the tab and came back hours later). Static
page — no data fetch, no auth gate, no state machine. Single CTA back
to `/swiper-registration` whose Continue button creates a fresh
session via `POST /api/stripe/connect`.

## Brand decisions

- Same `<Surface tone="subtle" padding="lg">` wrapper +
  `max-w-md py-16 px-6 sm:py-24` rhythm as
  `/stripe/onboard/complete` Almost-There fallback. The two pages
  read as a sibling pair — same visual family.
- One lime CTA: `<Button variant="primary" asChild>` wrapping the
  `<Link>`. No second action.
- `Session expired.` heading uses the redesign's
  `text-3xl/4xl semibold tracking-tight` rhythm.
- No Surface borders; tinted background is the only structure.

## Testid coverage

| Catalog ID | testid | Element |
|---|---|---|
| SWIP-ONBOARD-REFRESH | `onboard-refresh-page` | `<main>` |

## error.tsx

NOT colocated. Per `02-routes.md §4`, this route is not listed —
falls through to global `app/error.tsx`. The page has no failure
modes (no data fetch, no async work).

## Vitest specs

NONE — static page. Manual smoke at session close confirms the link
target.
