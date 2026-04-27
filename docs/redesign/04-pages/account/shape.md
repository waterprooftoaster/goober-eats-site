# `/account` — Shape

## Role + state branches

Authenticated user (orderer or swiper) viewing/managing their account
in a centered modal that closes via `router.back()`. The modal is
route-backed (not a parallel slot) so deep-linking and history both work.

State branches:
- `loading` — server-side parallel fetch of profile + stripe_account +
  schools (handled by Next.js loading.tsx if present, else inline).
- `orderer` — `profile.is_swiper === false`. Shows email, "My orders",
  Sign out, Delete account, and "Become a swiper" CTA.
- `swiper-pending-stripe` — `is_swiper === true` (or treated as such by
  swiper-section), `stripeAccount.onboarding_complete === false`. Shows
  the school management UI plus "Pending" Stripe pill + "Complete
  payment setup" CTA.
- `swiper-active` — `onboarding_complete === true`. Shows "Connected"
  Stripe pill + "Open dashboard" link.
- `school-changing` — sub-branch when the user clicks "Change" on
  their school. Combobox + Save + Cancel.
- `delete-confirming` — two-step confirmation row inside the action
  list.

The page itself is a server component delegating to `<AccountPanel />`
(client). All data lookups happen server-side; the client component
only manages UI state.

## Brand decisions (`.impeccable.md`)

- **One lime CTA per surface state.** In each visible state at most one
  primary lime button exists:
  - orderer: "Get started" become-swiper CTA (lime).
  - swiper-pending-stripe: "Complete payment setup" (lime).
  - swiper-active: "Open dashboard" is `variant="ghost"` (no lime —
    the lime CTA on this state is the school Save button when active).
  - delete-confirming: "Yes, delete" is destructive-tinted, NOT lime.
- **Modal primitive replaces hand-rolled `fixed inset-0`.** Same
  reasoning as /swiper/orders: focus trap, Escape, return-focus, all
  free via Radix Dialog. The `account-modal` testid moves to
  `<ModalContent>` (which also carries `data-testid="modal"` from the
  primitive).
- **Combobox replaces native `<select>`.** Same dual-input pattern as
  /swiper-registration so Playwright disambiguation
  `getByTestId('account-school-selector').getByRole('combobox')` works.
- **Tinted neutrals.** Status pills use `bg-primary/15` (10–15% lime
  tint) instead of `bg-green-100`. Pending pill uses `bg-muted`.
- **Inline error rows** (`role="alert"` + `text-destructive`).
- **Asymmetric, left-aligned.** ModalContent is `max-w-sm` flush-left;
  no centered hero inside the modal.

## Modal swap

Same architecture as /swiper/orders: `<Modal open onOpenChange={(o) => !o && router.back()}>` wraps `<ModalContent>`. The page's
top-level `<main data-testid="account-page">` becomes a `sr-only`
sentinel — the modal portals out of the DOM tree, so the testid still
lives on a real element for visual smoke and Playwright's
`getByTestId('account-page')` lookup.

`router.back()` on `onOpenChange(false)` preserves all the existing
deep-link semantics (Esc, X-button, backdrop-click — Radix handles all
three uniformly).

## Bug fix: dashboard endpoint

S01 markup wired `account-stripe-dashboard-button` to POST
`/api/stripe/connect`, which is the *relink* endpoint (creates a new
Connect account onboarding URL). The locked feature catalog
(`SWIP-ACCOUNT-STRIPE-DASHBOARD`) specifies POST
`/api/stripe/connect/dashboard` (Express dashboard one-time login link).
The redesign rebuild aligns the call site to the catalog. Same shape
as the S04 fix of the broken `eateries(name)` join: rebuild is the
natural moment to align code to the SHA-locked source of truth.

The dashboard button label changes from "Update payment info" →
"Open dashboard" to match the new behavior. No change to feature
identity — the testid stays `account-stripe-dashboard-button`.

## Combobox swap

Replaces the native `<select>` in the school-change sub-branch. Same
reasoning as /swiper-registration: searchable, autoHighlight, brand
consistency with auth-login. The dual-input wrapper
(`<div data-testid="account-school-selector">`) preserves the
Playwright disambiguation pattern.

## Testid coverage

| Catalog ID | testid | Element |
|---|---|---|
| SWIP-ACCOUNT-LOAD | `account-page` | `<main>` (sr-only sentinel) |
| SWIP-ACCOUNT-MODAL | `account-modal` | `<ModalContent>` |
| SWIP-ACCOUNT-EMAIL | `account-email-display` | `<p>` |
| SWIP-ACCOUNT-SIGNOUT | `account-signout-button` | `<Button variant="ghost">` |
| SWIP-ACCOUNT-DELETE | `account-delete-button` | initial `<Button>` (pre-confirm) |
| SWIP-ACCOUNT-BECOME-CTA | `account-become-swiper-cta` | `<Link>` inside `<Button asChild>` |
| SWIP-ACCOUNT-SCHOOL-SELECT | `account-school-selector` | `<div>` wrapping `<Combobox>` |
| (combined) | `account-school-save-button` | Save `<Button variant="subtle">` |
| SWIP-ACCOUNT-STRIPE-STATUS | `account-stripe-status` | pill `<span>` (both branches) |
| SWIP-ACCOUNT-STRIPE-LINK | `account-stripe-link-button` | `<Button variant="primary">` (pending) |
| SWIP-ACCOUNT-STRIPE-DASHBOARD | `account-stripe-dashboard-button` | `<Button variant="ghost">` (connected) |

## A11y

- Modal: Radix Dialog provides focus trap + Escape + return-focus +
  scroll-lock + aria-modal + aria-labelledby (via `<ModalTitle>`).
- Combobox: Base UI provides combobox/listbox roles + arrow-key nav.
- Buttons: real `<button>` with focus-visible rings.
- Banners: `role="alert"` for errors, `role="status"` for the
  "School saved" affirmation.
- Delete confirmation: separate visual row with destructive tint;
  Cancel button has equal weight (no easy mistake).

## error.tsx

NOT colocated. Per `02-routes.md §4`, the route falls through to the
global `app/error.tsx`. Failure modes here are network errors that
surface as inline `text-destructive` rows; the page itself renders
even if downstream queries return null.
