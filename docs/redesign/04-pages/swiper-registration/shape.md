# `/swiper-registration` — Shape

## Role + state branches

Authenticated orderer (`is_swiper=false`) opting into the swiper role.
Two-step form:
1. **School select.** Pick a school via Combobox; click Save → PATCH
   `/api/profile { school_id }`. After 200, the school is rendered as
   confirmed copy and the Continue CTA unlocks.
2. **Stripe Connect link.** POST `/api/stripe/connect` returns
   `{ url }` → `window.location.href = url` redirects to Stripe-hosted
   onboarding. Post-onboarding, Stripe redirects back to
   `/stripe/onboard/complete` (success) or `/stripe/onboard/refresh`
   (session expired).

State branches the design must absorb:
- `loading` (server fetch — Next.js loading.tsx if present, otherwise
  inline render).
- `school-unconfirmed` (combobox + Save button visible, Continue
  disabled).
- `school-saving` (Save button disabled with "Saving…" label).
- `school-confirmed` (school name shown as plain text; Continue
  enabled).
- `connecting` (Continue disabled with "Opening Stripe…" label, no
  optimistic transition — user stays on the page until window.location
  swaps).
- `error` (inline `<p role="alert">` text-destructive; surfaces on
  PATCH failure or Stripe POST failure).
- Server-side branches: `redirect /auth/login` (anon),
  `redirect /auth/login?onboarding=true` (auth user without profile),
  `redirect /account` (already a swiper).

## Brand decisions (`.impeccable.md`)

- **One lime CTA per screen** — only `Continue to payment setup` uses
  `<Button variant="primary">`. The Save School button is
  `<Button variant="subtle">` so the lime stays unambiguous.
- **Asymmetric, left-aligned** — `max-w-md py-16 px-6 sm:py-24`. No
  centered hero; no decorative card-inside-card.
- **Combobox replaces native `<select>`** — fintech-adjacent search-
  first input matching the auth-login school step. Same dual-input
  pattern (`<div data-testid="swiper-reg-school-selector">` wraps
  `<Combobox>`) so Playwright's
  `getByTestId('swiper-reg-school-selector').getByRole('combobox')`
  disambiguation pattern stays consistent across surfaces.
- **Inline error rows, not toasts** — `<p role="alert"
  text-destructive>` per S04/S05 user direction. The error testid
  `swiper-reg-error-message` survives.

## Combobox swap

The S03 `<Combobox>` primitive (Base UI) replaces the native `<select>`.
Three behavioral differences worth flagging:

1. **Searchable** — typing filters the list; native `<select>` only
   supports first-letter jump. For schools-list growth (>50 entries),
   this is a meaningful UX upgrade.
2. **Hidden `<input type="hidden" name="school_id">` is NOT required**
   here — the form submission is a fetch POST `/api/profile`, not a
   server-action FormData submission like /auth/login. The selected
   school value lives in component state and is read directly when
   building the JSON body. No hidden field.
3. **`autoHighlight` enabled** — first matching option is pre-selected
   so Enter selects it without needing arrow-key navigation. Same as
   auth-login.

The dual-input pattern (testid on the wrapper, role on the inner
input) is preserved so the Playwright disambiguation continues to work.

## §5 frozen API surface (consumed, not modified)

- `PATCH /api/profile` — body `{ school_id: <uuid> }`. Returns 200/400.
- `POST /api/stripe/connect` — no body. Returns `{ url }` or
  `{ error }`.

The form does not touch any other endpoint. No realtime, no storage,
no cookies set/read here.

## Testid coverage

| Catalog ID | testid | Element |
|---|---|---|
| SWIP-REG-LOAD | `swiper-registration-page` | `<main>` |
| SWIP-REG-SCHOOL | `swiper-reg-school-selector` | `<div>` wrapping `<Combobox>` |
| SWIP-REG-SAVE-SCHOOL | `swiper-reg-save-button` | Save `<Button variant="subtle">` |
| SWIP-REG-STRIPE | `swiper-reg-continue-button` | Continue `<Button variant="primary">` |
| SWIP-REG-ERROR | `swiper-reg-error-message` | `<p role="alert">` |

## A11y

- Combobox: Base UI provides `role="combobox"` + `role="listbox"`
  automatically; arrow-keys navigate, Enter selects, Escape clears
  search.
- Buttons: real `<button>` from primitive; focus-visible rings.
- Errors: `role="alert"` for assertive AT announcement.
- The "Your school" group is a `<p>` heading + control pair; no
  decorative icons.

## error.tsx

NOT colocated. Per `02-routes.md §4`, the route falls through to the
global `app/error.tsx`. Failure modes here (network errors, Stripe
endpoint 500) surface inline as `swiper-reg-error-message` instead of
crashing the render.
