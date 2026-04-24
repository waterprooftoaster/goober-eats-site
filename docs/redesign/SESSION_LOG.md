# Goober Eats Frontend Redesign — Session Log

Append-only. One H2 per session, closed before the session ends. See plan §13 (`/Users/waterprooftoaster/.claude/plans/copy-paste-the-block-recursive-mist.md`) for full schema.

---

## Session 01 — Inventory + E2E testid pre-migration (CLOSED)

- **Date:** 2026-04-24
- **Branch:** `fpoop` (per user direction: no separate redesign branch; work in place)
- **Phase(s):** 0 (feature catalog) + pre-4 (testid migration scaffolding)
- **Status:** CLOSED
- features.md SHA-256: `e6be0f544ad92a1ebd9e853687d2fa09f5847633ebdfb21f10f219b1a333539f`

### What shipped

1. **Feature catalog (`docs/redesign/00-features.md`)** — 91 feature IDs across 5 namespaces:
   ORD=20, SWIP=24, GUEST=4, AUTH=13, GLOBAL=30. Locked at the SHA-256 above; future
   changes require an entry in `docs/redesign/FEATURES_CHANGELOG.md`.

2. **`data-testid` pre-migration (non-destructive)** — added to current markup so E2E
   selectors survive the Session 04–07 redesign:

   - **Auth (`app/auth/login/login-form.tsx`)**: `auth-email-input`,
     `auth-continue-button`, `auth-password-input`, `auth-password-confirm-input`,
     `auth-signin-button` / `auth-signup-button` (conditional), `auth-fullname-input`,
     `auth-name-continue-button`, `auth-school-input`, `auth-onboarding-complete-button`,
     `auth-back-button`, `auth-callback-error`, `auth-form-error`.
   - **Home (`app/page.tsx`)**: `home-page`, `home-file-input`, `home-place-order-button`,
     `home-error-message`.
   - **Shell (`app/layout.tsx`, `components/header.tsx`, `components/swiper-orders-button.tsx`)**:
     `root-layout`, `header`, `header-home-link`, `header-account-link`,
     `header-auth-buttons`, `swiper-orders-button`, `swiper-orders-badge`.
   - **Chat (`components/chat/*`, `components/chat-panel/*`)**: `chat-view`,
     `chat-thread`, `chat-pseudo-placed-order`, `chat-pseudo-in-progress`,
     `chat-input-active` / `chat-input-waiting` (conditional on `disabled`),
     `chat-send-button`, `chat-photo-upload`, `completion-banner`,
     `swiper-complete-order-button`, `swiper-unaccept-button`,
     `order-completed-view`, `chat-panel-stack`, `chat-panel-header`.
   - **Swiper queue (`app/swiper/orders/*`, `components/order/screenshot-gallery.tsx`)**:
     `swiper-orders-page`, `pending-orders-list`, `swiper-orders-empty-state`,
     `swiper-order-detail-modal`, `swiper-accept-button`,
     `swiper-accept-success-banner`, `swiper-screenshot-gallery`.
   - **Account (`app/account/*`, `components/account-panel.tsx`)**: `account-page`,
     `account-modal`, `account-email-display`, `account-signout-button`,
     `account-delete-button`, `account-become-swiper-cta`, `account-school-selector`,
     `account-school-save-button`, `account-stripe-status`, `account-stripe-link-button`,
     `account-stripe-dashboard-button`.
   - **Swiper registration (`app/swiper-registration/*`)**: `swiper-registration-page`,
     `swiper-reg-school-selector`, `swiper-reg-save-button`,
     `swiper-reg-continue-button`, `swiper-reg-error-message`.
   - **Stripe onboard (`app/stripe/onboard/*`)**: `onboard-almost-there-page`,
     `onboard-refresh-page`.
   - **Guest entry (`app/order/[orderId]/guest-panel-opener.tsx`)**:
     `guest-panel-opener`, `guest-bootstrap-spinner`.

3. **E2E spec migrations (`getByText`/`getByPlaceholder`/`getByRole` → `getByTestId`)**:
   - `tests/e2e/auth.setup.ts` (auth setup; unblocks all `authenticated/**` specs)
   - `tests/e2e/auth.spec.ts`
   - `tests/e2e/home.spec.ts`
   - `tests/e2e/guest-chat.spec.ts`
   - `tests/e2e/authenticated/completion-banner.spec.ts`
   - `tests/e2e/authenticated/swiper-pending.spec.ts`
   - `tests/e2e/authenticated/swiper.spec.ts`
   - `tests/e2e/authenticated/mobile-nav.spec.ts` (partial — see flagged item below)

4. **Frozen-string extraction (`lib/constants.ts`)** — single declaration site for
   editable-code frozen strings: `PENDING_SCREENSHOTS_KEY`, `messagesChannel(id)`,
   `ordersOrdererChannel(id)`. Consumers updated: `app/page.tsx`, `app/checkout/page.tsx`,
   `components/chat-panel/chat-panel-provider.tsx`, `hooks/use-messages.ts`. Bucket
   names and content-type allowlists are NOT re-declared here — they already have
   single authoritative declarations in frozen paths (`app/api/**`, `lib/types/api.ts`).

5. **Catalog lockdown** — added `docs/redesign/check-features-hash.mjs` and
   `npm run lint:features-hash` script. Sentinel exits non-zero if `00-features.md`
   diverges from the SHA above without a matching `FEATURES_CHANGELOG.md` entry.

6. **Catalog amendments applied (pre-lockdown):**
   - Renamed `AUTH-LOGIN-COMPLETE.testid` from `auth-signup-button` to
     `auth-onboarding-complete-button` to break collision with the password-step
     submit (which already carries `auth-signup-button` for new users).
   - Added `AUTH-LOGIN-PASSWORD-CONFIRM` (testid `auth-password-confirm-input`).
   - Added `AUTH-LOGIN-NAME-CONTINUE` (testid `auth-name-continue-button`) — covers
     the existing client-side step transition from name → school.
   - Added `SWIP-REG-SAVE-SCHOOL` (testid `swiper-reg-save-button`) — already
     present in `swiper-registration-form.tsx`.

### Baseline grep counts (per plan §9)

```
$ grep -R "pending_screenshots\|guest_order_token_\|cart-screenshots\|completion-photos" \
    app components hooks lib/constants.ts lib/auth 2>/dev/null | grep -v node_modules | wc -l
10

$ grep -R "supabase.channel" app components hooks 2>/dev/null | wc -l
0
```

The literal `supabase.channel` grep returns 0 because all call sites use
multi-line method chains (`supabase\n  .channel(...)`) which the literal grep
doesn't span. Authoritative count via `grep -R "\.channel(" app components hooks`
= 2 (both routed through `messagesChannel`/`ordersOrdererChannel` helpers).

The 10 frozen-string occurrences are: 1 declaration (`lib/constants.ts`),
3 in `app/api/cart-screenshots/upload-url/route.ts` (frozen path),
2 in `app/api/messages/[orderId]/upload/route.ts` (frozen path),
1 fetch URL + 1 doc-comment in `app/page.tsx`,
2 file-header comments. No second declaration of `pending_screenshots`
in editable code — sentinel intent satisfied.

### Verification gauntlet

- `npm run lint` — green
- `npm run test` (vitest) — 21 files / 209 tests passed
- `npm run build` (Next.js + tsc) — green; 26 routes generated
- `npm run lint:features-hash` — green; matches recorded SHA-256
- `git diff HEAD` against frozen paths (`app/api/**`, `lib/supabase/**`,
  `lib/stripe/**`, `lib/orders/state-machine.ts`, `lib/types/**`,
  `lib/api/{guest-auth,helpers}.ts`, `supabase/**`, `scripts/**`) — 0 lines
- `npx playwright test` — 25 passed, 10 failed (all pre-existing — see below), 16 skipped
  (gated by failed beforeAll hooks). One Session 01 regression caught and fixed:
  `auth-school-input` is a `<div>` wrapping a Base UI Combobox that renders TWO
  `<input>`s (visible combobox + hidden form input); `.locator('input')` matched
  both and tripped Playwright strict mode. Fixed by narrowing to
  `.getByRole('combobox')` in `tests/e2e/auth.spec.ts` (lines 59, 167). Re-running
  `auth.spec.ts` alone after the fix: 2/2 passed.

Note on the contract sentinel form: master plan §9 specifies `git diff main`
which produces ~5600 lines of pre-existing fpoop-vs-main divergence. For
in-place work on `fpoop`, `git diff HEAD` is the operationally correct sentinel
(working tree vs last commit). Session 02 onward should use the same form.

### Pre-existing broken cases (flagged, NOT migrated)

- `tests/e2e/authenticated/mobile-nav.spec.ts:58` — the `swiper dashboard icon`
  test navigates to `/swiper/dashboard` which does not exist in the current
  route tree (real route is `/swiper/orders`). Left unmigrated with an inline
  comment; revisit when the dashboard page lands (Session 07 shell rewrite at
  earliest).
- `tests/e2e/api/orders-status.spec.ts:24` — POSTs `/api/orders/{id}/pay`,
  but no `pay` route exists under `app/api/orders/[id]/`. Endpoint was removed
  during the cart-screenshot rewrite; spec was not updated.
- The following `authenticated/**` specs reference the **deleted** `eateries`
  and `menu_items` tables (and the `seed_dev_eateries` RPC) in their
  `beforeAll` hooks, so they fail before the test body runs. Per the new
  domain model these specs need to be rewritten against `cart_screenshot_urls`
  + `total_cents`. Out of Session 01 scope (testid migration only):
  - `authenticated/chat.spec.ts:112`
  - `authenticated/checkout-pipeline.spec.ts:90` (also depends on a Stripe
    webhook that doesn't fire locally without `stripe listen`)
  - `authenticated/completion-banner.spec.ts:112` (only the beforeAll touches
    deleted tables; the test body itself uses migrated testids correctly)
  - `authenticated/order-lifecycle.spec.ts:120`
  - `authenticated/orders.spec.ts:77`
  - `guest-chat.spec.ts:277` (only this one test of the file; the other
    guest-chat tests pass)

### Notable scope deviation

- `components/chat/chat-view.tsx` and `components/chat/chat-thread.tsx` —
  the strict "non-destructive" mantra was relaxed minimally so two distinct
  pseudo-messages (placed-order vs in-progress) could carry distinct testids
  without restructuring markup. Introduced an exported `PseudoMessage` type
  (`{ text: string; testid?: string }`) and updated the call sites + the
  `chat-thread.test.tsx` unit test to the new shape. This is the only behavior-
  adjacent edit in the session; rendered text and conditions are unchanged.

### Files touched (editable surface only)

```
app/account/account-actions.tsx
app/account/swiper-section.tsx
app/auth/login/login-form.tsx
app/checkout/page.tsx
app/layout.tsx
app/order/[orderId]/guest-panel-opener.tsx
app/page.tsx
app/stripe/onboard/complete/page.tsx
app/stripe/onboard/refresh/page.tsx
app/swiper-registration/page.tsx
app/swiper-registration/swiper-registration-form.tsx
app/swiper/orders/page.tsx
app/swiper/orders/pending-orders-list.tsx
components/account-panel.tsx
components/chat-panel/chat-panel-provider.tsx
components/chat-panel/chat-panel.tsx
components/chat/chat-input.tsx
components/chat/chat-thread.tsx
components/chat/chat-view.tsx
components/chat/completion-banner.tsx
components/chat/order-completion-notice.tsx
components/header.tsx
components/order/screenshot-gallery.tsx
components/swiper-orders-button.tsx
hooks/use-messages.ts
lib/constants.ts
package.json
tests/e2e/auth.setup.ts
tests/e2e/auth.spec.ts
tests/e2e/authenticated/completion-banner.spec.ts
tests/e2e/authenticated/mobile-nav.spec.ts
tests/e2e/authenticated/swiper-pending.spec.ts
tests/e2e/authenticated/swiper.spec.ts
tests/e2e/guest-chat.spec.ts
tests/e2e/home.spec.ts
tests/unit/components/chat/chat-thread.test.tsx
docs/redesign/00-features.md
docs/redesign/check-features-hash.mjs
docs/redesign/SESSION_LOG.md
```

Frozen surface (`app/api/**`, `lib/supabase/**`, `lib/stripe/**`,
`lib/orders/state-machine.ts`, `lib/types/**`, `lib/api/{guest-auth,helpers}.ts`,
`supabase/**`, `scripts/**`) — UNTOUCHED, sentinel verified.

### Next entry point

**Session 02 — Flows + route tree ADR.** Produce `docs/redesign/01-flows.md`
(state diagrams for every flow, keyed by feature ID) and `docs/redesign/02-routes.md`
(route tree decisions for the redesigned shell). No code changes in Session 02.
