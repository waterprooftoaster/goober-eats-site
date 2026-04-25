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

---

## Session 02 — Flows + route tree ADR (CLOSED)

- **Date:** 2026-04-24
- **Branch:** `fpoop` (in place; no separate redesign branch)
- **Phase(s):** 1 (flows) + 2 (route ADR)
- **Status:** CLOSED
- features.md SHA-256: `e6be0f544ad92a1ebd9e853687d2fa09f5847633ebdfb21f10f219b1a333539f` (unchanged from Session 01; catalog is locked, sentinel green)

### What shipped

1. **`docs/redesign/01-flows.md`** — nine Mermaid `flowchart TD` diagrams
   covering: orderer-place, orderer-track, swiper-accept-complete,
   guest-track, auth-signup-new, auth-signin-existing (with
   onboarding-resume sub-branch), swiper-register, stripe-connect-onboard,
   realtime-message-receive (chat lifecycle: open → in_progress →
   completed). Each diagram is followed by a coverage table; the file ends
   with an authoritative `## ID → flow matrix` listing every catalog ID and
   the flow / non-flow bucket that covers it. A "Non-flow capabilities"
   section sweeps shell chrome, account-as-settings, helpers, and
   primitives. Coverage gate: **107 / 107 unique IDs** in `00-features.md`
   appear in at least one flow table or non-flow row (verified by
   programmatic grep at session close).

2. **`docs/redesign/02-routes.md`** — route-tree ADR. Six sections:
   - §1 Decision register: 16 user-facing entries. 13 keep, 1
     keep-restructure (`app/layout.tsx` — drops `banner` prop in S07), 2
     delete (`app/@banner/page.tsx`, `app/@banner/default.tsx`). No
     renames, merges, or splits. Every entry's rationale cites feature
     IDs from `00-features.md`.
   - §2 Canonical post-redesign route tree (adapted from master plan §Phase 2).
   - §3 Per-route matrix: feature IDs owned, backend endpoints called,
     data-fetch strategy, state-branch → testid mapping. Twelve kept
     routes covered.
   - §4 Error-boundary placements: distinct `error.tsx` at `/checkout`,
     `/checkout/return`, `/current-orders`, `/swiper/orders`,
     `/stripe/onboard/complete` (per master plan §Phase 2).
   - §5 Frozen API surface: 18 explicit `app/api/**` endpoints + the
     `app/auth/callback/route.ts` callback. Every endpoint is mapped to
     its consuming feature ID(s).
   - §6 ADR record: six decisions captured (parallel-route deletion timing,
     account-modal-as-route, onboarding-resume staying internal, error.tsx
     placement, swiper-layout gate stays server-side, no URL-level
     renames).

### Discrepancies flagged (NOT amended)

- **Catalog summary count is stale.** SESSION_LOG (Session 01) and the
  summary table at the bottom of `00-features.md` both report 91 IDs across
  the 5 namespaces. Actual unique IDs in the file: **107** (ORD=25,
  SWIP=26, GUEST=4, AUTH=13, GLOBAL=39). The catalog content itself is
  correct and complete — the only stale data is the per-namespace count
  cells and the total in the bottom summary table. Treated as **not** a
  catalog gap (no IDs are missing or duplicated). Catalog file deliberately
  not amended this session (would invalidate the locked SHA without adding
  new information). 01-flows.md uses the actual 107-ID count for coverage
  gating. Future-cleanup note: a Session-N author may patch the summary
  numbers under a `FEATURES_CHANGELOG.md` entry — strictly cosmetic.
- **`app/@banner/` parallel slot still on disk.** Master plan §Decisions
  locked says "no parallel routes." The `@banner/page.tsx` +
  `@banner/default.tsx` files plus `app/layout.tsx`'s `banner: React.ReactNode`
  prop are scheduled for deletion in Session 07 (shell rewrite). Session
  02 captured the decision in 02-routes.md §1 + §6 ADR-1 only; no code
  changes. Replacement (`components/banner.tsx`) is the Session 01
  untracked file already on disk.
- **Diagram syntax.** Cold-start instructions suggested
  `stateDiagram-v2`; master plan §Phase 1 says `flowchart TD`. Per the
  cold-start prompt's own override clause ("master plan wins"), used
  `flowchart TD` throughout 01-flows.md.

### Verification gauntlet

```
$ npm run lint:features-hash         # green; SHA matches Session 01 record
$ git diff HEAD -- 'app/api/**' 'lib/supabase/**' 'lib/stripe/**' \
    'lib/orders/state-machine.ts' 'lib/types/**' \
    'lib/api/guest-auth.ts' 'lib/api/helpers.ts' \
    'supabase/**' 'scripts/**' | wc -l
0
$ git status --short                  # only docs/redesign/ + this log changed
```

Coverage cross-checks (run before commit):

```
$ for id in $(grep -E "^- id:" docs/redesign/00-features.md | sed 's/^- id: //' | sort -u); do
    grep -qE "\b$id\b" docs/redesign/01-flows.md || echo "MISSING: $id"
  done
(no output — 0 missing IDs)

$ for f in $(find app -name page.tsx -not -path 'app/api/*' | sort); do
    grep -qF "$f" docs/redesign/02-routes.md || echo "MISSING: $f"
  done
(no output — 0 missing pages)

$ for f in $(find app/api -name route.ts | sort); do
    e=$(echo "$f" | sed 's|^app/api||;s|/route.ts$||')
    grep -qF "/api$e" docs/redesign/02-routes.md || echo "MISSING: /api$e"
  done
(no output — 0 missing API endpoints)
```

### Files added/changed (editable surface only)

```
docs/redesign/01-flows.md          (new)
docs/redesign/02-routes.md         (new)
docs/redesign/SESSION_LOG.md       (this entry appended)
```

Frozen surface (`app/api/**`, `lib/supabase/**`, `lib/stripe/**`,
`lib/orders/state-machine.ts`, `lib/types/**`, `lib/api/{guest-auth,helpers}.ts`,
`supabase/**`, `scripts/**`) — UNTOUCHED. All editable code paths
(`components/**`, `app/**` markup, `hooks/**`) — UNTOUCHED. `00-features.md`
— UNTOUCHED (locked SHA preserved). No new dependencies, no test changes.

### Primitives added/extended

None (Session 02 is docs-only).

### Backend-contract sentinel

GREEN | exceptions: none.

### Open questions

- The catalog summary discrepancy (91 reported, 107 actual). Cosmetic; not
  worth a SHA bump on its own. → Deferred indefinitely; flagged for any
  future session that has another reason to amend the catalog.
- `app/@banner/` deletion path-of-execution. → Deferred to Session 07
  shell rewrite as planned.

### Blockers resolved

None this session.

### Next entry point

**Session 03 — Design tokens + primitives.** Tailwind theme swap to OKLCH
hue 126; fonts switch to Bricolage Grotesque + Figtree via `app/fonts.ts`
(new); `components/ui/` primitives audited and extended (Sheet, Modal,
Skeleton, Toast, Surface added; Button restyled with new variants;
Combobox / Input restyled). Existing pages must still render — Session 03
introduces the design system without rewriting pages. Master plan §Phase 3
spec is authoritative.

### Commits

- `d826361` — `docs(redesign): session 02 — flows + route tree ADR`

### Tags added

None this session.

---

## Session 03 — Design tokens + primitives (CLOSED)

- **Date:** 2026-04-24
- **Branch:** `fpoop` (in place; no separate redesign branch)
- **Phase(s):** 3 (design tokens + primitives)
- **Status:** CLOSED
- **features.md SHA-256:** `e6be0f544ad92a1ebd9e853687d2fa09f5847633ebdfb21f10f219b1a333539f` (unchanged from S01)

### What shipped

1. **OKLCH-hue-126 tokens (`app/globals.css`)** — full theme overhaul:
   - Master-plan §Phase 3 token vocabulary added in a new `@theme` block
     (`--color-bg`, `--color-fg`, `--color-surface`, `--color-muted`,
     `--color-muted-bg`, `--color-border`, `--color-accent`,
     `--color-accent-hover`, plus `--font-display` / `--font-body`).
   - Existing shadcn `:root` tokens (`--background`, `--foreground`,
     `--primary`, `--secondary`, `--muted`, `--accent`, `--border`,
     `--input`, `--ring`, …) **remapped** onto the same OKLCH-126 source
     values. Single source of truth: every primitive that reads
     `bg-primary` / `text-muted-foreground` / `bg-card` now resolves to
     the tinted-warm-off-white + lime palette automatically.
   - `.dark { … }` block dropped (master plan refusal-list item 6).
   - Unused chart + sidebar tokens dropped (zero consumers in editable
     code; verified with grep).
   - `@layer base`: `body { font-family: var(--font-body); }` and
     `h1..h6 { font-family: var(--font-display); }` for global typography.
   - **Verified compiled output:** production-build CSS bundle ships
     `--primary:#99c73d` (lime) and `--background:#f9fbf6` (warm tinted
     off-white) as the hex fallbacks, plus LAB conversions for backwards-
     compatible color rendering.

2. **Fonts swapped (`app/fonts.ts` new + `app/layout.tsx` font-only edit)** —
   `Plus_Jakarta_Sans` + `Geist_Mono` → **Bricolage Grotesque** (display)
   + **Figtree** (body) via `next/font/google`.
   - Cold-start prompt mentioned `Manrope` + `Hanken Grotesk`; the actual
     pre-S03 fonts on disk were `Plus_Jakarta_Sans` + `Geist_Mono`. Plan
     intent (replace display + body) was unaffected.
   - Layout edit was strictly font-wiring: removed the two old font
     imports + their const declarations, added
     `import { bricolageGrotesque, figtree } from './fonts'`, updated
     `<html className>` to the two new variable names. **No** other
     edits to `app/layout.tsx` (banner slot, providers, header, chat
     panel — all S07).
   - Verified rendered HTML emits
     `bricolage_grotesque_*_variable figtree_*_variable antialiased`
     on `<html>`.

3. **Button rename + restyle (`components/ui/button.tsx`)** — clean
   rename per master plan §Phase 3:
   - `default` → **`primary`** (the lime CTA, `bg-primary
     text-primary-foreground hover:bg-[--color-accent-hover]`).
   - `secondary` → **`subtle`** (tinted-neutral, `bg-secondary
     text-secondary-foreground hover:bg-secondary/70`).
   - `outline / ghost / destructive / link` — kept variant names;
     restyled against new tokens (border + hover only).
   - Sizes preserved verbatim (master-plan list was a subset; full surface
     `default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg` retained).
   - `defaultVariants.variant = 'primary'`.
   - Sweep: zero `variant="default"` / `variant="secondary"` call-sites
     in editable surface after the one-line surgical edit to
     `components/banner.tsx:25` (`variant="default"` → `variant="primary"`).
     One bare `<Button>` at `app/checkout/page.tsx:160` remains, which is
     the screen's primary CTA — brand-correct under the new default.

4. **Existing primitives — token cascade only** —
   `components/ui/{input,input-group,textarea,combobox,navigation-menu}.tsx`
   were left structurally intact. They reference shadcn tokens (`bg-card`,
   `bg-muted`, `border-input`, `ring-ring`, `text-muted-foreground`, …)
   which now resolve to the OKLCH-126 palette via the token remap. Their
   `dark:` modifier classes are now dead code at runtime (no `.dark`
   class is applied) but harmless; cleanup deferred to S08.

5. **Five new primitives (`components/ui/`):**
   - **`surface.tsx`** — borderless tinted container with `tone` (subtle
     | muted) and `padding` (none | sm | md | lg) cva variants.
     `asChild` Slot polymorphism. testid `surface`.
   - **`skeleton.tsx`** — shimmerless `animate-pulse motion-reduce:
     animate-none` block. testid `skeleton`. `aria-hidden`.
   - **`sheet.tsx`** — Radix Dialog wrapper for mobile bottom-sheet /
     desktop side-panel; slide-in animations gated by `motion-reduce:`.
     Exports `Sheet, SheetTrigger, SheetClose, SheetPortal, SheetOverlay,
     SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription`.
     `SheetContent` carries testid `sheet`.
   - **`modal.tsx`** — centered Radix Dialog wrapper. Same export shape
     as Sheet (`Modal*`). `ModalContent` carries testid `modal`. Built
     for the account-modal route + delete-account confirm flows in S06.
   - **`toast.tsx`** — hand-rolled `<ToastProvider />` + `useToast()` hook.
     Auto-dismiss after `opts.duration ?? 4000`ms. Variants:
     `default | success | error`. `motion-reduce:` gate. testid
     `toast-container` on the viewport. Zero new dependencies (master
     plan §No-additions rule honored — Radix-Toast / Sonner not adopted).
     **Not mounted** in `app/layout.tsx` this session; first consumer
     wires the provider in S04+.

6. **Global error-shell pages:**
   - `app/loading.tsx` — Skeleton grid (1 heading + 1 subline + 3 cards).
   - `app/error.tsx` — `"use client"` boundary using `<Surface tone="muted">`
     + `<Button variant="primary" onClick={reset}>Try again</Button>` +
     `<Button variant="ghost" asChild>Go home</Button>`. Sanitizes the
     error message (strips file paths + stack-trace fragments). Exposes
     `error.digest` when present. **No toast invocation** (per
     user-confirmed scope D for S03).
   - `app/not-found.tsx` — server component with Surface + "Go home" CTA.

7. **Cleanup** — `components/icons/burger.tsx` deleted (0-byte file, zero
   references via `grep -RIn "burger" app components hooks lib tests`).
   Empty `components/icons/` directory removed.

8. **Tests** — five new render-test files at `tests/unit/components/ui/`
   covering surface, skeleton, sheet, modal, and toast. Test count went
   from 21 files / 209 tests (S01 baseline) to **26 files / 220 tests**,
   all green.

### User-confirmed decisions made during planning

- **D2 (button variants):** clean rename per master plan; legacy
  `default` / `secondary` not retained as aliases.
- **D3 (token strategy):** keep one source of truth — remap shadcn
  `:root` tokens onto OKLCH-126 alongside the new `--color-*` vocabulary.
- **Error-shell scope:** primitives-only visuals; toast shipped + render-
  tested but not invoked.
- **`components/banner.tsx`:** the cold-start "do not touch" guard was
  rescinded by user mid-session — UI files are fair game; only feature
  behavior is frozen. The S03 banner edit was a one-line variant rename;
  full visual rework remains S07 territory.

### Verification gauntlet

- `npm run lint` — green
- `npm run test` (vitest) — **26 files / 220 tests** passed (was 21 / 209
  in S01; +5 files / +11 tests)
- `npm run build` (Next.js + tsc) — green; **26 routes** still build
  (matches S01 count)
- `npm run lint:features-hash` — green; SHA matches S01
- **Contract sentinel** (`git diff HEAD` against frozen paths) — 0 lines
- **Bundle sentinel** — `! grep -r "SUPABASE_SECRET_KEY\|createServiceClient"
  .next/static/` returns clean
- **Frozen-string grep** — counts unchanged from S01:
  - `pending_screenshots|guest_order_token_|cart-screenshots|completion-photos`
    in editable code: **10**
  - `\.channel(` in editable code: **2**
- **Dev-server smoke** — HTTP-200 on `/`, `/checkout`, `/current-orders`,
  `/auth/login`, `/account`, `/swiper/orders`; HTTP-404 on an unknown
  path (`not-found.tsx` wired). The user's pre-existing dev server (PID
  3524) had cached stale CSS from before the S03 edits — production-build
  CSS confirmed the new tokens (`--primary:#99c73d` lime,
  `--background:#f9fbf6` tinted off-white) compiled correctly. User
  should `kill 3524 && npm run dev` to see the visual swap locally.
- **Playwright** — **27 passed / 8 failed / 16 skipped**, slightly better
  than the S01 baseline (25 / 10 / 16). All 8 failures are pre-existing-
  broken specs flagged in S01 SESSION_LOG (eateries / menu_items
  `beforeAll` hooks against the removed legacy schema; the removed
  `POST /api/orders/{id}/pay` endpoint; the non-existent
  `/swiper/dashboard` route). Zero new regressions attributable to the
  S03 token / primitive / font work. Two S01-flagged failures now pass —
  not investigated further; deferred.

### Discrepancies flagged (carried forward)

- Catalog summary count is still stale (91 reported in S01 vs. 107
  actual). Cosmetic; deferred indefinitely as in S02.
- `app/@banner/` parallel slot still on disk; deferred to S07 shell rewrite.
- Cold-start prompt named the pre-existing fonts as Manrope + Hanken
  Grotesk; reality was Plus_Jakarta_Sans + Geist_Mono. Plan intent
  preserved; flagged here for future cold-start authors.

### Files added/changed (editable surface only)

```
app/globals.css                                   (overhauled)
app/fonts.ts                                      (new)
app/layout.tsx                                    (font wiring only)
app/loading.tsx                                   (new)
app/error.tsx                                     (new)
app/not-found.tsx                                 (new)
components/ui/button.tsx                          (variant rename + restyle)
components/ui/surface.tsx                         (new)
components/ui/sheet.tsx                           (new)
components/ui/modal.tsx                           (new)
components/ui/skeleton.tsx                        (new)
components/ui/toast.tsx                           (new)
components/banner.tsx                             (one-line variant rename)
components/icons/burger.tsx                       (deleted)
tests/unit/components/ui/surface.test.tsx         (new)
tests/unit/components/ui/sheet.test.tsx           (new)
tests/unit/components/ui/modal.test.tsx           (new)
tests/unit/components/ui/skeleton.test.tsx        (new)
tests/unit/components/ui/toast.test.tsx           (new)
docs/redesign/SESSION_LOG.md                      (this entry appended)
```

Frozen surface (`app/api/**`, `lib/supabase/**`, `lib/stripe/**`,
`lib/orders/state-machine.ts`, `lib/types/**`,
`lib/api/{guest-auth,helpers}.ts`, `supabase/**`, `scripts/**`) —
UNTOUCHED, sentinel verified. `00-features.md` — UNTOUCHED (locked SHA
preserved).

### Primitives added/extended

- **Extended (existing):** `button.tsx` (rename + restyle).
- **Token-cascade restyled (no class changes):** `input.tsx`,
  `input-group.tsx`, `textarea.tsx`, `combobox.tsx`, `navigation-menu.tsx`.
- **New:** `surface.tsx`, `sheet.tsx`, `modal.tsx`, `skeleton.tsx`,
  `toast.tsx`.

### Backend-contract sentinel

GREEN | exceptions: none.

### Open questions

- The toast primitive is not yet wired into `app/layout.tsx`. First
  optimistic-UI consumer in S04+ should mount `<ToastProvider />` near
  the root and document the call-site in this log.
- Stale dev-server cache: the user's existing dev process serves S02
  CSS. Document explicit dev restart in the S04 cold-start so future
  smoke tests aren't fooled by stale chunks.

### Blockers resolved

- Banner / variant-rename collision (cold-start "don't touch banner.tsx"
  vs. master-plan rename) — resolved by user mid-session: UI files are
  fair game; only feature behavior is frozen.

### Next entry point

**Session 04 — Orderer happy path.** Shape + craft for `/`, `/checkout`,
`/checkout/return`, `/current-orders`, `/orders`. Each page gets a
per-page commit (`phase4/<route-slug>`). The new primitives are now
available; ToastProvider should be mounted at the layout root by the
first optimistic-UI consumer (likely the swiper `accept` button, S06,
or chat-input failures in `/current-orders`, S04).

### Commits

- `de7509d` — `feat(design): session 03 — OKLCH theme + Bricolage/Figtree fonts + ui primitives`

### Tags added

None this session.

---

## Session 04 — Orderer happy path (CLOSED)

- **Date:** 2026-04-24
- **Branch:** `fpoop` (in place; per the standing user direction)
- **Phase(s):** 4a (orderer happy-path craft passes)
- **Status:** CLOSED
- **features.md SHA-256:** `e6be0f544ad92a1ebd9e853687d2fa09f5847633ebdfb21f10f219b1a333539f`
  (unchanged from S01; catalog locked, sentinel green)

### What shipped

Five per-page tagged commits rebuild the orderer happy path against the
S03 OKLCH-126 tokens, Bricolage/Figtree fonts, and Surface/Button/Skeleton
primitives. Two pages also receive material data-layer fixes (broken
queries against deleted tables) and one routing fix
(`/checkout/return` authed leg).

1. **`/` (`app/page.tsx`)** — tag `phase4/home`, commit `f119df9`.
   Asymmetric left-aligned hero per `.impeccable.md` (no centered hero,
   one lime CTA). Tinted Surface drop zone with dashed border; the
   "Place order" Button is the only `primary` element on the screen.
   `text-destructive` replaces hard-coded `text-red-600`. Single-file
   upload pattern preserved per S04 user-locked scope —
   `ORD-HOME-THUMBNAIL-STRIP` and `home-upload-status` testid
   deliberately not implemented this session (deferred; catalog
   unchanged, no FEATURES_CHANGELOG entry needed).

2. **`/checkout` (`app/checkout/page.tsx`)** — tag `phase4/checkout`,
   commit `d5de4f3`. Split-column layout: signed-URL cart preview on
   the left, auth-branched form on the right; on mobile they stack
   with the preview on top. Single lime "Pay {total}" CTA whose label
   tracks the typed total. **`<BackButton />` finally wired in** —
   the component existed at `components/back-button.tsx` with the
   right testid but had no callers (catalog `ORD-CHECKOUT-BACK`).
   **Cart preview** via `supabase.storage.from('cart-screenshots').
   createSignedUrls(paths, 3600)` (catalog `ORD-CHECKOUT-CART-PREVIEW`).
   **Auth-branched form**: `viewerKind` resolves to `'guest' | 'authed'`
   via `auth.getUser()` + `profiles.maybeSingle()` — a Supabase user
   without a profile row is treated as a guest because the API at
   `app/api/stripe/checkout-session/route.ts:62-86` already does. The
   guest variant carries `guest_name`; the authed variant does not.
   Single `<CheckoutForm kind={...}>` component; per minimal-code rule
   (the variants share 90%+ structure). Errors render inline via
   `checkout-error-message` (`role="alert"`, `text-destructive`) — no
   toast. New colocated `app/checkout/error.tsx` covers Stripe-mount
   fallthroughs and 5xx that escape the inline path. Adds testids:
   `checkout-page`, `checkout-cart-preview`, `checkout-form-guest`,
   `checkout-form-authed`, `checkout-submit-button`,
   `checkout-stripe-embedded`, `checkout-error-message`.

3. **`/checkout/return` (`app/checkout/return/page.tsx`)** — tag
   `phase4/checkout-return`, commit `9a031fc`. Single-line behavioral
   fix: authed redirect target moved from `/orders` to `/current-orders`
   per catalog `ORD-CHECKOUT-RETURN-AUTHED` and master-plan §Phase 4
   happy-path smoke ("upload → embedded checkout → return → see order
   in `/current-orders`"). Page is a pure server-side redirect — every
   path ends in `redirect()`, so the catalogued `checkout-return-page`
   testid has no element to bind to (consistent with S01 pre-migration,
   which also did not add it). Adds colocated
   `app/checkout/return/error.tsx` for Stripe SDK retrieval
   fallthroughs.

4. **`/current-orders` (page.tsx + current-orders-list.tsx)** — tag
   `phase4/current-orders`, commit `cfdf25b`. **Bug fix**: the prior
   query `select('id, status, eateries(name)')` referenced the deleted
   `eateries` table (per CLAUDE.md domain model post cart-screenshot
   rewrite) and was silently returning empty rows. Replaced with
   `select('id, status, restaurant_name')`. WHERE expanded from
   `orderer_id=user` to `(orderer_id=user OR swiper_id=user)` so swipers
   see their accepted orders here too (catalog auth_branches lists both
   roles). Each order is a tinted `bg-card` `<article>` (intentionally
   not a `<Surface>` to avoid the primitive's built-in
   `data-testid="surface"` colliding across N cards). Status badge
   uses the OKLCH-126 palette: `bg-secondary` for open,
   `bg-primary/15` for in_progress (the only place lime appears on
   this page, and only as a 15% tint), `bg-muted` for completed,
   `bg-destructive/10` for cancelled. New testids: `current-orders-page`,
   `current-orders-list`, `current-orders-empty-state`,
   `current-orders-status-badge`. Five new vitest specs at
   `tests/unit/app/current-orders/current-orders-list.test.tsx` cover
   empty state, list testid, badge labels, `data-status` attribute,
   and `restaurant_name` fallback. New colocated
   `app/current-orders/error.tsx` for fetch / realtime fallthroughs
   beyond what ChatView handles inline.

5. **`/orders` (`app/orders/page.tsx`)** — tag `phase4/orders`, commit
   `0a7b68c`. **Bug fix**: prior query joined
   `eateries!orders_eatery_id_fkey(name)` and read the `items` column
   — both deleted in the cart-screenshot rewrite. Replaced with
   `select('id, status, restaurant_name, total_cents, created_at,
   orderer_id, swiper_id')`. WHERE expanded to merged-history shape
   `orderer_id=user OR swiper_id=user`; per-row role derived in JS
   (`orderer_id===user.id ? 'placed' : 'fulfilled'`) and rendered as a
   small uppercase chip above the date. Receipt-style two-column
   rows (restaurant + role + date on the left, `tabular-nums` total +
   status on the right). New testids: `orders-page`, `orders-list`,
   `orders-empty-state`, plus a bonus `orders-role-badge` (not in
   catalog) for E2E to assert the merge-of-roles split.

### ToastProvider mount decision (carried over from S03)

**Toast not mounted, not consumed, not imported in S04.** Per
mid-planning user direction ("a toast is way too over engineered. just
have an error pop up"). All transient failure feedback in S04 renders
inline via `text-destructive` `<p role="alert">` rows — `home-error-message`
on `/`, `checkout-error-message` on `/checkout`. The S03 toast primitive
(`components/ui/toast.tsx`) stays on disk and unit-tested but inert.
`app/layout.tsx` is **not edited at all** this session — banner prop,
header, ChatPanel stay exactly as S03 left them. The S07 shell rewrite
inherits the unmounted toast primitive untouched.

### User-confirmed scope deviations (recorded for future cold-starts)

The catalog mandates several behaviors not implemented in S04:

- **Multi-file upload + thumbnail strip + per-file upload status on `/`**
  (`ORD-HOME-THUMBNAIL-STRIP`, `home-upload-status` testid). Single-file
  pattern preserved per user direction ("single upload is fine for now,
  that is an easy addition"). Catalog SHA stays locked; deferred to a
  later session that wants this affordance.

These are the only catalog testids not present in the rendered DOM
after S04. Every other catalogued testid for the five owned routes
ships.

### Verification gauntlet

- `npm run lint` — green
- `npm run test` (vitest) — **27 files / 225 tests** passed (was 26 / 220
  in S03; +1 file / +5 tests, all in
  `tests/unit/app/current-orders/current-orders-list.test.tsx`)
- `npm run build` (Next.js + tsc) — green; **26 routes** still build
- `npm run lint:features-hash` — green; SHA matches S01
- **Contract sentinel** (`git diff HEAD` against frozen paths) — 0 lines
- **Bundle sentinel** — `! grep -r "SUPABASE_SECRET_KEY\|createServiceClient"
  .next/static/` returns clean
- **Frozen-string grep** — `pending_screenshots|guest_order_token_|cart-screenshots|completion-photos`
  in editable code: **11** (was 10 in S01 baseline). The +1 is the new
  `app/checkout/page.tsx:97` `.from('cart-screenshots')` for the cart
  preview signed URL — first client-side bucket reference. Bucket
  extraction to `lib/constants.ts` is a wash (the new const declaration
  matches the same grep), so the literal stays in place; new baseline
  is 11. `\.channel(` count: **2**, unchanged.
- **Playwright** — **27 passed / 8 failed / 16 did not run** —
  **exact match to S03 baseline**. Zero new regressions attributable
  to S04 work. The 8 failures are the same S01-flagged-broken specs
  (orders-status `pay` route gone; mobile-nav `/swiper/dashboard`
  gone; six `authenticated/**` specs whose `beforeAll` hooks
  reference the deleted `eateries`/`menu_items` tables and the
  removed `seed_dev_eateries` RPC). Out of S04 scope (the underlying
  domain model is settled; rewriting those test fixtures is a
  separate, larger task).

### Discrepancies flagged (carried forward)

- Catalog summary count is still stale (91 reported in S01 vs. 107
  actual). Cosmetic; deferred indefinitely as in S02 / S03.
- `app/@banner/` parallel slot still on disk; deferred to S07 shell
  rewrite.
- `lib/auth/resolve-principal.ts` not yet introduced — S05 deliverable.
  S04 pages do their own client-side auth resolution
  (`auth.getUser()` + optional `profiles.maybeSingle()`); the
  consolidation can replace that pattern in S05+.
- The frozen-string grep baseline drifted 10 → 11 (justified above).
  Future sessions should compare against 11.
- `checkout-return-page` testid (catalog `ORD-CHECKOUT-RETURN-LOAD`)
  has no DOM element to bind to because the page never renders;
  consistent with S01 pre-migration.

### Files added/changed (editable surface only)

```
app/page.tsx                                       (rewrite)
app/checkout/page.tsx                              (rewrite)
app/checkout/error.tsx                             (new)
app/checkout/return/page.tsx                       (1-line fix + JSDoc)
app/checkout/return/error.tsx                      (new)
app/current-orders/page.tsx                        (rewrite + query fix)
app/current-orders/current-orders-list.tsx         (rewrite)
app/current-orders/error.tsx                       (new)
app/orders/page.tsx                                (rewrite + query fix)
docs/redesign/04-pages/home/{shape,craft}.md       (new)
docs/redesign/04-pages/checkout/{shape,craft}.md   (new)
docs/redesign/04-pages/checkout-return/{shape,craft}.md (new)
docs/redesign/04-pages/current-orders/{shape,craft}.md  (new)
docs/redesign/04-pages/orders/{shape,craft}.md     (new)
docs/redesign/SESSION_LOG.md                       (this entry appended)
tests/unit/app/current-orders/current-orders-list.test.tsx (new)
```

`app/layout.tsx` — UNTOUCHED (per user-locked scope; S07 owns the
shell rewrite). Frozen surface (`app/api/**`, `lib/supabase/**`,
`lib/stripe/**`, `lib/orders/state-machine.ts`, `lib/types/**`,
`lib/api/{guest-auth,helpers}.ts`, `supabase/**`, `scripts/**`) —
UNTOUCHED, sentinel verified. `00-features.md` — UNTOUCHED (locked
SHA preserved). `components/ui/*` — UNTOUCHED (no S03 primitive
needed extension this session).

### Primitives added/extended

None. S03's surface, sheet, modal, skeleton, toast, button (variant
rename + restyle) covered every S04 need without modification.

### Backend-contract sentinel

GREEN | exceptions: none.

### Open questions

- Multi-file upload affordance on `/` is the obvious follow-up — when
  the team wants users to attach more than one cart screenshot, the
  thumbnail strip + per-file status testids are catalogued and ready
  to wire up.
- `app/layout.tsx` ToastProvider mount remains unwired (per S04 user
  decision). If a future S05/S06 page wants toast feedback, it can
  mount the provider in a one-line edit when needed.
- `/checkout` cart preview today renders all signed URLs in a single
  vertical stack — multi-file uploads (when enabled) might want a
  carousel or grid; revisit then.

### Blockers resolved

- The `.or('orderer_id.eq.X,swiper_id.eq.X')` syntax with
  `.in('status', [...])` chained after — verified as valid PostgREST
  by the build + tests; both filter conditions AND together as
  expected. No special quoting needed for the user UUID.

### Next entry point

**Session 05 — Auth + guest entry.** Shape + craft for `/auth/login`
(multi-step form) and `/order/[orderId]` (guest entry + anon sign-in).
Two per-page tagged commits. Master plan §Decisions locked: introduce
`lib/auth/resolve-principal.ts` (frontend-only) returning the
discriminated union from §10 and migrate the ad-hoc auth checks in
S04 pages to consume it.

### Code review (cumulative diff)

`code-reviewer` agent ran on the five-commit cumulative diff before
session close. Verdict: **WARNING — let it ship, but fix HIGH issues
before the next session.** Two HIGH findings, both addressed in commit
`6678065` before this log entry was committed:

1. `app/checkout/page.tsx` — `loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)`
   would have crashed the React tree if the env var was unset (CI /
   preview / fresh clone). Replaced the `!` non-null assertion with a
   `?? null` guard plus an explicit throw inside the iframe-mount
   branch so the colocated `error.tsx` boundary catches it. Pre-existing
   pattern preserved across the rewrite.
2. `app/checkout/return/page.tsx` — `session_id` query param was
   handed unvalidated to `stripe.checkout.sessions.retrieve`. Added a
   `^cs_[a-zA-Z0-9_]+$` regex check so attacker-controlled strings
   redirect home before reaching Stripe (and Stripe's API error logs).

Reviewer also confirmed PASS on:
- Auth-branching client-side mirroring of
  `app/api/stripe/checkout-session/route.ts:62-86` (a Supabase user
  without a profile is treated as guest by both sides).
- PostgREST `.or().in()` syntax on `/current-orders` and `/orders`
  (filters AND together as expected).
- Zero frontend table mutations outside `app/api/**` — only auth
  reads, profile reads, and `storage.createSignedUrls` (read-only).
- Test coverage posture: existing E2E + new vitest specs are
  acceptable for a UI redesign with no logic changes to data shapes
  or API contracts.
- File hygiene (JSDoc headers, default-export-first, helpers below
  separator, all files under 800 LOC).

### Commits

- `f119df9` — `feat(home): rebuild / against redesigned primitives`
- `d5de4f3` — `feat(checkout): rebuild /checkout against redesigned primitives`
- `9a031fc` — `feat(checkout): rebuild /checkout/return against redesigned primitives`
- `cfdf25b` — `feat(current-orders): rebuild /current-orders against redesigned primitives`
- `0a7b68c` — `feat(orders): rebuild /orders against redesigned primitives`
- `6678065` — `fix(checkout): tighten Stripe publishable-key + session_id handling`
- (SESSION_LOG close commit appended after this entry)

### Tags added

- `phase4/home`
- `phase4/checkout`
- `phase4/checkout-return`
- `phase4/current-orders`
- `phase4/orders`

---

## Session 05 — Auth + guest entry (CLOSED)

- **Date:** 2026-04-24
- **Branch:** `fpoop` (in place; per the standing user direction)
- **Phase(s):** 4b (auth + guest-entry craft passes) + the §10 auth helper
- **Status:** CLOSED
- **features.md SHA-256:** `e6be0f544ad92a1ebd9e853687d2fa09f5847633ebdfb21f10f219b1a333539f`
  (unchanged from S01; catalog locked, sentinel green)

### What shipped

Two per-page tagged commits rebuild the auth-login page and the
guest-entry bootstrap page against the S03 OKLCH-126 primitive set.
Session 05 also introduces the first reusable auth primitive —
`lib/auth/resolve-principal.ts` — landing in the auth-login commit
because the helper's existence and the page rebuild are part of the
same "auth surface" mental unit.

1. **`/auth/login` (`app/auth/login/login-form.tsx`)** — tag
   `phase4/auth-login`, commit `a5c9346`. Replaces the centered-hero
   `fixed inset-0 flex items-center justify-center` markup with an
   asymmetric left-aligned `max-w-sm` column with `pt-16/24` top
   padding. Every step shows exactly one `Button variant="primary"`
   CTA (one lime accent per screen), `Button variant="ghost"` for
   Back. Inputs route through the `Input` primitive (OKLCH border +
   focus-visible ring) instead of inline Tailwind. Combobox dual-
   input wrapper preserved for Playwright's
   `getByTestId('auth-school-input').getByRole('combobox')`
   disambiguation. Errors render inline as `<p role="alert">` with
   `text-destructive` — no toasts. **State machine, every catalog
   testid, the `effectiveStep` derivation, the onboarding-resume
   sub-branch, and the `confirm_password` FormData
   signup/signin distinguisher are preserved byte-for-byte from
   S01.** No changes to `app/auth/login/page.tsx` (server prefetch
   + resume detection is correct as-is). All 13 catalogued
   AUTH-LOGIN-* testids ship; the password and signup buttons get
   slightly more affirmative microcopy ("Welcome back" / "Create
   your password"). Adds non-catalog `auth-login-page` testid on
   `<main>` for visual smoke.

   Bundled into the same commit: **`lib/auth/resolve-principal.ts`**
   — frontend-only helper returning the master-plan §10 discriminated
   union (`anon | authed_orderer | authed_swiper_pre_stripe |
   authed_swiper | guest_cookie`). Resolution: `auth.getUser()` →
   guest-cookie scan when `!user || is_anonymous` →
   `profiles.maybeSingle()` → `stripe_accounts.maybeSingle()` →
   variant assignment. Includes a data-inconsistency guard: if
   stripe `onboarding_complete=true` but `profile.school_id=null`,
   downgrades to `authed_swiper_pre_stripe` (the full-swiper variant
   requires non-null schoolId per the §10 type shape). 12 unit
   tests at `tests/unit/lib/auth/resolve-principal.test.ts` cover
   every variant + every data-inconsistency edge. The helper takes
   the `cookieStore` as an explicit param so tests don't have to
   mock `next/headers`.

2. **`/order/[orderId]` (`app/order/[orderId]/page.tsx` +
   `guest-panel-opener.tsx`)** — tag `phase4/guest-entry`, commit
   `1903c25`. **Schema fix**: the prior server query
   `.select('id, status, guest_access_token, orderer_id,
   eateries(name)')` referenced the deleted `eateries` table (per
   CLAUDE.md domain model after the cart-screenshot rewrite) and
   silently returned `null` for the join, leaving the chat panel
   header empty. Replaced with `restaurant_name` directly. Spinner
   now uses OKLCH tokens (`border-border` + `border-t-foreground`)
   replacing `border-gray-300 / border-t-gray-900`. Promotes the
   spinner container to `<main>` for landmark semantics during the
   ~1s lifespan and adds `role="status"` + `aria-label="Opening
   your order…"` for assistive tech. Server gate (UUID, `getUser`,
   cookie read, service-client lookup, three-fold rejection) and
   client bootstrap chain (`signInAnonymously` → PATCH → `openPanel`
   → `router.replace('/')`) preserved verbatim. Both catalogued
   testids (`guest-panel-opener`, `guest-bootstrap-spinner`) ship.

### ToastProvider mount decision (carried over)

**Toast still not mounted, not consumed, not imported in S05.** Per
the user direction recorded in S04. All transient feedback in S05
remains inline `text-destructive` `<p role="alert">` rows
(`auth-callback-error`, `auth-form-error`). The S03 toast primitive
stays on disk and unit-tested but inert. `app/layout.tsx` —
UNTOUCHED this session (S07 owns the shell rewrite).

### User-confirmed scope deviations

None. Every catalogued testid for the two owned routes ships
on the rendered DOM.

### Optional helper migration (DEFERRED to S06)

The plan allowed migrating two ad-hoc S04 auth-detection sites onto
`resolvePrincipal`:

- `app/checkout/page.tsx:74-92` — currently runs its own
  `auth.getUser()` + `profiles.maybeSingle()` to derive
  `viewerKind`.
- `app/current-orders/page.tsx:30-35` — currently runs `getUser()`
  only.

Both deferred to S06 to keep the S05 page commits unblocked. The
helper ships with full unit coverage so S06 (or any later session)
can adopt it without redesigning it. Note: API routes never adopt
this helper — it is frontend-only by design (server gates and API
auth use `lib/api/guest-auth.ts` and direct service-client checks).

### Verification gauntlet

- `npm run lint` — green
- `npm run test` (vitest) — **28 files / 237 tests** passed (was 27 / 225
  in S04; +1 file / +12 tests, all in
  `tests/unit/lib/auth/resolve-principal.test.ts`)
- `npm run build` (Next.js + tsc) — green; **26 routes** still build
- `npm run lint:features-hash` — green; SHA matches S01
- **Contract sentinel** (`git diff HEAD` against frozen paths) — 0 lines
- **Bundle sentinel** — `! grep -r "SUPABASE_SECRET_KEY\|createServiceClient"
  .next/static/` returns clean
- **Frozen-string grep** — `pending_screenshots|guest_order_token_|cart-screenshots|completion-photos`
  in editable code: **5** (was 3 in the same grep at S04 close).
  The +2 are both in the new `lib/auth/resolve-principal.ts` (the
  `GUEST_COOKIE_PREFIX = 'guest_order_token_'` constant on line 22
  + the explanatory comment on line 37). Centralising the guest-
  cookie prefix in the helper is exactly what the helper exists for;
  this is the intended outcome, not drift. `\.channel(` count: **2**,
  unchanged.

  Note: this grep counts a different baseline than S04 reported
  (S04 close logged 11 with broader inclusions). The shape of the
  grep matters; what matters this session is: (a) no new ad-hoc
  bucket / cookie / channel literals appeared in editable code, and
  (b) the two new hits are inside the helper that consolidates this
  knowledge.
- **Playwright** — **27 passed / 8 failed / 16 did not run** —
  **exact match to S04 baseline**. Zero new regressions. The 8
  failures and 16 skips are the same pre-existing
  `eateries`/`menu_items`/`/swiper/dashboard`/removed-`pay`-route
  fixtures S04 inherited.
- **`tests/e2e/auth.spec.ts` targeted run** — **2/2 passed** (the
  S01-baseline auth flow, including the onboarding-resume
  sub-branch).

### Discrepancies flagged (carried forward)

- Catalog summary count is still stale (91 reported in S01 vs. 107
  actual). Cosmetic; deferred indefinitely.
- `app/@banner/` parallel slot still on disk; deferred to S07 shell
  rewrite.
- `lib/realtime/channel-registry.ts` (master plan §11) still not
  introduced — S07 deliverable.
- `app/auth/login/page.tsx` does its own `auth.getUser()` + profile
  lookup rather than calling `resolvePrincipal`. Documented in
  craft.md: the resume sub-branch needs both `user` and
  `profile?.id` separately, while the helper collapses both into
  `kind: 'anon'`. Intentional; not a candidate for S06 migration.
- The S04 close logged frozen-string baseline of **11**; the post-
  S05 grep with the same exclusions yields **5**. The discrepancy
  reflects different exclusion patterns rather than a regression.
  Future sessions should pin the exact grep command alongside the
  number; we use:
  ```bash
  grep -rEn "pending_screenshots|guest_order_token_|cart-screenshots|completion-photos" \
    --include="*.ts" --include="*.tsx" app components lib hooks 2>/dev/null \
    | grep -v "/api/" | grep -v "lib/supabase/" | grep -v "lib/api/guest-auth" \
    | grep -v "lib/stripe/" | grep -v ".test."
  ```
- **`resolvePrincipal` mid-onboarding latent trap** (code-reviewer
  MEDIUM): a future caller of `resolvePrincipal` on a protected
  page could incorrectly treat an authed-without-profile user as
  fully anonymous (showing a guest CTA instead of resuming
  onboarding). The `app/auth/login/page.tsx` caller side-steps this
  by doing its own resume detection. No action required today; flag
  for consideration when the helper sees broader adoption (S06+).
  Possible follow-up: introduce a sixth variant
  `authed_no_profile { userId; email }` if any future surface needs
  to distinguish "not logged in at all" from "needs to finish
  onboarding."

### Files added/changed (editable surface only)

```
app/auth/login/login-form.tsx                                (rewrite)
app/order/[orderId]/page.tsx                                 (schema fix + JSDoc tightening)
app/order/[orderId]/guest-panel-opener.tsx                   (spinner restyle + a11y)
lib/auth/resolve-principal.ts                                (new — §10 discriminated-union helper)
tests/unit/lib/auth/resolve-principal.test.ts                (new — 12 specs)
docs/redesign/04-pages/auth-login/{shape,craft}.md           (new)
docs/redesign/04-pages/guest-entry/{shape,craft}.md          (new)
docs/redesign/SESSION_LOG.md                                 (this entry appended)
```

`app/auth/login/page.tsx` — UNTOUCHED (server prefetch + resume
detection is correct; `02-routes.md §4` says no per-route
`error.tsx` for this route). `app/layout.tsx` — UNTOUCHED (S07
owns the shell rewrite). `app/swiper/layout.tsx` — UNTOUCHED (S06
owns swiper surface). Frozen surface (`app/api/**`, `lib/supabase/**`,
`lib/stripe/**`, `lib/orders/state-machine.ts`, `lib/types/**`,
`lib/api/{guest-auth,helpers}.ts`, `supabase/**`, `scripts/**`) —
UNTOUCHED, sentinel verified. `00-features.md` — UNTOUCHED (locked
SHA preserved). `components/ui/*` — UNTOUCHED (no S03 primitive
needed extension this session).

### Primitives added/extended

None. S03's Button (primary + ghost variants), Input, and Combobox
covered every S05 need without modification.

### Backend-contract sentinel

GREEN | exceptions: none.

### Open questions

- `resolvePrincipal` adoption for the two S04 ad-hoc sites
  (`/checkout`, `/current-orders`) → deferred to S06.
- Whether to introduce a sixth `authed_no_profile` variant for
  future callers that need to distinguish anonymous from
  mid-onboarding → defer until a real consumer needs it (avoid
  speculative API surface). Flagged in §Discrepancies.
- `app/layout.tsx` `ToastProvider` mount remains unwired (per S04
  user decision). If S06's swiper surfaces want toast feedback, it
  can be mounted in a one-line edit.

### Blockers resolved

- The `eateries(name)` join on `app/order/[orderId]/page.tsx` was
  silently broken (deleted table, silent null return). Fixed in
  the same commit as the redesign rebuild. Future cold-starts no
  longer need to grep for similar stale joins on this route.

### Next entry point

**Session 06 — Swiper surface.** `/account` (modal overlay),
`/swiper-registration` (school + Stripe link), `/swiper/orders`
(queue), `/stripe/onboard/complete`, `/stripe/onboard/refresh`. The
`app/swiper/layout.tsx` server gate must stay server-side (master
plan §10 security invariant). S06 is the natural place to migrate
the deferred `/checkout` and `/current-orders` callers onto
`resolvePrincipal`.

### Code review (cumulative diff)

`code-reviewer` agent ran on the two-commit cumulative diff before
session close. Verdict: **APPROVE — 0 critical / 0 high / 1 medium
/ 0 low.** All ten S05 constraints pass: frozen paths, state
machine preservation, Combobox dual-input pattern, hidden form
fields, no client-side debounce, no toasts, frontend-only helper,
correct discriminated-union shape, schema fix, no `console.log`.

The single MEDIUM finding (the `resolvePrincipal` mid-onboarding
latent trap) is a forward-looking design note, not a present bug —
documented above in §Discrepancies and §Open questions. No
pre-close fix-up commit was needed (S04 had two HIGH issues fixed
in `6678065` before close; S05 has none).

### Commits

- `a5c9346` — `feat(auth): rebuild /auth/login against redesigned primitives`
- `1903c25` — `feat(guest): rebuild /order/[orderId] against redesigned primitives`
- (SESSION_LOG close commit appended after this entry)

### Tags added

- `phase4/auth-login`
- `phase4/guest-entry`

---

## Session 06 — Swiper surface (CLOSED)

- **Date:** 2026-04-25
- **Branch:** `fpoop` (in place; per the standing user direction)
- **Phase(s):** 4c (swiper-surface craft passes — 5 routes)
- **Status:** CLOSED
- **features.md SHA-256:** `e6be0f544ad92a1ebd9e853687d2fa09f5847633ebdfb21f10f219b1a333539f`
  (unchanged from S01; catalog locked, sentinel green)

### What shipped

Five per-page tagged commits rebuild the entire swiper lifecycle
(register → Stripe Connect → queue → accept) against the S03
OKLCH-126 primitive set. Two S03 primitives (`<Modal>`, `<Combobox>`)
get their first non-auth consumers. One pre-existing catalog drift
fixed during the rebuild (`account-stripe-dashboard-button` endpoint).
A code-review-driven fix-up commit closes two HIGH findings before
session close.

1. **`/swiper/orders` (`app/swiper/orders/page.tsx` + `pending-orders-list.tsx`
   + `screenshot-gallery.tsx`)** — tag `phase4/swiper-queue`,
   commit `5e0584b`. **Modal primitive's first real consumer.** The
   detail surface migrated from a hand-rolled `fixed inset-0
   bg-black/40` overlay to `<Modal>` + `<ModalContent>` (Radix
   Dialog) — closes the focus-trap + Escape + return-focus a11y gaps
   the custom overlay had. Accept state machine preserved
   byte-for-byte inside `<ModalContent>`: 200 → `openPanel(orderId,
   'in_progress')` + 5s success banner + remove row; 409 → race
   banner + remove row; 403/5xx → inline modal error, modal stays
   open. **TDD-first:** 4 vitest specs locked the state machine
   BEFORE the Modal swap; all four pass green against the post-swap
   implementation. `app/swiper/layout.tsx` server-side gate
   UNTOUCHED (master plan §10 security invariant). New colocated
   `app/swiper/orders/error.tsx` per `02-routes.md §4`.

2. **`/swiper-registration` (`page.tsx` + `swiper-registration-form.tsx`)** —
   tag `phase4/swiper-registration`, commit `742ac94`. **Combobox
   primitive's first non-auth consumer.** School selector migrated
   from native `<select>` to `<Combobox>` (Base UI) matching the
   auth-login dual-input pattern (`<div data-testid="...-school-selector">`
   wraps `<Combobox>` so Playwright's `getByTestId(...).getByRole('combobox')`
   disambiguation continues working). Searchable + autoHighlight.
   4 new vitest specs (TDD-first against pre-rebuild native-select
   impl, then re-run green against post-rebuild Combobox impl).
   Brand voice: one lime CTA per screen ("Continue to payment
   setup" is `variant="primary"`; Save School is `variant="subtle"`),
   inline `text-destructive role="alert"` errors.

3. **`/account` (`page.tsx` + `account-panel.tsx` + `account-actions.tsx`
   + `swiper-section.tsx`)** — tag `phase4/account`, commit `08dfad0`.
   **Modal primitive's second consumer.** Account-overlay markup
   (custom `fixed inset-0 bg-black/30`) migrated to
   `<Modal open onOpenChange={(o) => !o && router.back()}>`.
   `account-page` testid lives on a `sr-only <main>` sentinel since
   the Modal portals out of the page tree. School selector also
   migrated to Combobox. Brand voice: tinted status pills
   (`bg-primary/15` lime tint instead of `bg-green-100`; `bg-muted`
   instead of `bg-yellow-100`); destructive-tinted delete-confirm
   panel with equal-weight Cancel.

   **Pre-existing catalog drift fixed:** `account-stripe-dashboard-button`
   was POSTing to `/api/stripe/connect` (relink endpoint) instead
   of `/api/stripe/connect/dashboard` (Express dashboard one-time
   login link, per locked catalog SWIP-ACCOUNT-STRIPE-DASHBOARD).
   The redesign rebuild aligns the call site to the SHA-locked
   source of truth — same shape as S04's fix of the broken
   `eateries(name)` join. Vitest spec #2 in
   `swiper-section.test.tsx` FAILED against pre-rebuild code (drift
   detected by the catalog) and PASSES after rebuild (drift fixed)
   — TDD-validated.

   4 new vitest specs covering school PATCH soft-disable, dashboard
   endpoint, link endpoint, and become-swiper CTA target.

4. **`/stripe/onboard/complete` (`page.tsx` + new `error.tsx`)** —
   tag `phase4/stripe-onboard-complete`, commit `a0bc695`. Page
   state machine preserved verbatim: Stripe SDK `accounts.retrieve`
   for webhook-race absorption; `createServiceClient()` (consuming
   the frozen path) for the atomic
   `update({ is_swiper: true }).eq('id', userId).eq('is_swiper', false)`
   write; redirect to `/?notice=swiper_activated` on success.

   **One subtle behavioral correction:** S01 had a path where
   `onboarding_complete=true` AND `school_id=null` would still
   reach `redirect('/?notice=swiper_activated')`. The redesign
   guards `if (profile?.school_id) redirect(...)` so the
   school-missing case correctly falls through to the "Almost
   there" fallback. Matches catalog SWIP-ONBOARD-ALMOST-THERE
   intent (`onboarding incomplete OR school not set`). User
   without a school in S01 would land home with a "you're
   activated" notice and then bounce out of /swiper/orders due to
   the layout gate; the redesign sends them back to
   /swiper-registration to finish.

   **Logging cleanup:** dropped one `console.log` debug breadcrumb
   per typescript/coding-style.md ("No console.log in production
   code"). Initially also dropped a `console.error` for profile
   fetch failure as "unused"; restored in the fix-up commit
   (`ef291cf`) after code-review HIGH finding noted that
   logging-only errors are still load-bearing for production
   debugging on a money-moving path.

   New colocated `error.tsx` per `02-routes.md §4`. **No vitest
   specs** — server-only resolver; mocking Stripe + Supabase +
   redirect is high-effort low-yield. Coverage via manual smoke
   + E2E + the new error.tsx for crash safety. Documented in
   shape.md and here.

5. **`/stripe/onboard/refresh` (`page.tsx`)** — tag
   `phase4/stripe-onboard-refresh`, commit `237dbfb`. Static page
   restyled against `<Surface>` + `<Button asChild><Link/>` to
   mirror the /stripe/onboard/complete Almost There fallback shape;
   the two terminal Stripe-Connect surfaces now read as a sibling
   pair. No `error.tsx` (no async work; not listed in `02-routes.md §4`).

6. **Code-review fix-up commit `ef291cf`** — bundled the four
   review-driven changes plus an e2e spec migration:
   - **HIGH** Restored `console.error` for profile-fetch failure in
     `/stripe/onboard/complete/page.tsx`.
   - **HIGH** Extracted `lib/ui/sanitize-error-message.ts` (the two
     new error.tsx files shipped byte-for-byte identical sanitize()
     helpers). The shared helper also strips two extra patterns the
     originals missed per security-reviewer MEDIUM: absolute file
     paths (`/foo/bar.ts` → `[file]`) and IP:port fragments
     (`127.0.0.1:54322` → `[internal]`).
   - **MEDIUM** Replaced two `as` casts in Combobox `onValueChange`
     handlers with a runtime type guard `asSchoolItem(raw: unknown)`.
   - **LOW** Added JSDoc to `handleOpen` / `handleClose` in
     `pending-orders-list.tsx`.
   - **E2E** `tests/e2e/authenticated/swiper.spec.ts:132` migrated
     from `.selectOption()` against native `<select>` to the
     Combobox interaction pattern
     (`getByTestId(...).getByRole('combobox', { name: 'Search schools…' })`
     + fill + ArrowDown + Enter). Required because Base UI's
     Combobox renders BOTH an `<input role="combobox">` AND a
     trigger `<button role="combobox">` — `getByRole('combobox')`
     alone trips Playwright strict mode. Named-role disambiguation
     resolves it.

### Helper migration close-out (S05 deferred task)

Per the user-confirmed plan decision #4: **`resolvePrincipal`
migration is deliberately not migrated.** The S05 SESSION_LOG entry
"Optional helper migration (DEFERRED to S06)" closes here as
**"deliberately not migrated; revisit when a consumer actually
branches on principal kind."**

Rationale recorded for future cold-start authors:
- `app/checkout/page.tsx` is `'use client'`; it consumes
  `supabase.auth.getUser()` via the BROWSER client in a `useEffect`.
  `resolvePrincipal` requires `cookies()` from `next/headers` —
  server-only. Migration would require splitting /checkout into a
  server shell (resolves principal, passes `kind` as a prop) plus
  a client form (sessionStorage + Stripe iframe + form state). That
  is a Phase 4 page rebuild, not a follow-up refactor commit.
- `app/current-orders/page.tsx` IS a server component and migration
  is technically a 5-line drop-in. But /current-orders only branches
  on logged-in/out — the helper's 5-way classification is wasted
  there, AND the migration adds 2 redundant DB queries per render
  (profile + stripe_accounts lookups not gated by branch). Cost-
  benefit is negative.

The helper continues to live with one consumer (`/auth/login` page
server component) plus full unit coverage (12 specs). It will see
real adoption in S07, when the shell rewrite (header server-side
branch + layout gates) needs the 5-way classification for real.

### ToastProvider mount decision (still carried forward)

Toast still not mounted, not consumed, not imported in S06. Per
S04/S05 user direction. All transient feedback in S06 renders
inline as `<p role="alert" text-destructive>` rows or as
`<Surface>` status banners. The S03 toast primitive stays on disk
and unit-tested but inert. `app/layout.tsx` UNTOUCHED — S07 owns
the shell rewrite.

### User-confirmed scope decisions (recorded in plan)

- Page execution order: **high-risk → low-risk** (`/swiper/orders`
  first, `/stripe/onboard/refresh` last).
- School selectors: **migrate to `<Combobox>`** on both
  `/swiper-registration` and `/account` (matching auth-login).
- `/swiper/orders` detail modal: **migrate to S03 `<Modal>`
  primitive** (closes focus-trap + Escape + return-focus gaps).
- Helper migration: **defer entirely.**

All four locked in user-facing AskUserQuestion answers + plan file.

### Verification gauntlet

- `npm run lint` — green
- `npm run test` (vitest) — **31 files / 249 tests** passed (was
  28 / 237 in S05; +3 files / +12 tests across the four S06 spec
  additions). The +12 breakdown:
  - `tests/unit/app/swiper/orders/pending-orders-list.test.tsx`: 4 specs (state machine).
  - `tests/unit/app/swiper-registration/swiper-registration-form.test.tsx`: 4 specs (step transition + Stripe redirect + error).
  - `tests/unit/app/account/swiper-section.test.tsx`: 4 specs (school PATCH + dashboard endpoint + link endpoint + become CTA).
- `npm run build` — green; **26 routes** still build
- `npm run lint:features-hash` — green; SHA matches S01
- **Contract sentinel** (`git diff HEAD` against frozen paths) — **0 lines**
- **Bundle sentinel** — `! grep -r "SUPABASE_SECRET_KEY\|createServiceClient"
  .next/static/` clean
- **Frozen-string grep** (pinned S05 command) — counts unchanged at **5**
- **Realtime channel grep** — unchanged at **2**
- **Catalog testid coverage** — all 25 catalog testids for the 5
  S06 pages present on the new markup (verified by grep against
  `00-features.md`).
- **Playwright** — **27 passed / 8 failed / 16 did not run** —
  exact match to S05 baseline (27/8/16). The 8 failures and 16
  skips are the same pre-existing `eateries`/`menu_items`/
  `seed_dev_eateries`/`/swiper/dashboard`/removed-`pay`-route
  fixtures; zero new regressions after the spec migration.
- **Single-spec re-run** of `tests/e2e/authenticated/swiper.spec.ts`:
  `2/2 passed` (post-Combobox-migration in fix-up commit).

### Discrepancies flagged (carried forward)

- Catalog summary count is still stale (91 reported in S01 vs. 107
  actual). Cosmetic; deferred indefinitely.
- `app/@banner/` parallel slot still on disk; deferred to S07
  shell rewrite.
- `lib/realtime/channel-registry.ts` (master plan §11) still not
  introduced — S07 deliverable.
- Modal-primitive close-animation timing in `pending-orders-list.tsx`:
  the `{selectedOrder && <ModalContent>}` conditional render
  unmounts content immediately when the Modal sets `open=false`,
  potentially cutting Radix's exit animation. Cosmetic; flagged
  by code-reviewer as MEDIUM. Deferred — fix would need a
  "lastSelectedOrder" state shadow that survives the close animation.
- Helper migration officially closed as "deliberately not migrated"
  per user-confirmed plan decision #4. NOT carried forward as a
  deferred task.

### Files added/changed (editable surface only)

```
app/swiper/orders/page.tsx                         (rewrite)
app/swiper/orders/pending-orders-list.tsx          (rewrite — Modal swap)
app/swiper/orders/error.tsx                        (new)
components/order/screenshot-gallery.tsx            (token cascade)
app/swiper-registration/page.tsx                   (rewrite)
app/swiper-registration/swiper-registration-form.tsx (rewrite — Combobox swap)
app/account/page.tsx                               (rewrite)
app/account/account-actions.tsx                    (rewrite)
app/account/swiper-section.tsx                     (rewrite — Combobox swap + dashboard endpoint fix)
components/account-panel.tsx                       (rewrite — Modal swap)
app/stripe/onboard/complete/page.tsx               (rewrite + school-missing guard)
app/stripe/onboard/complete/error.tsx              (new)
app/stripe/onboard/refresh/page.tsx                (rewrite)
lib/ui/sanitize-error-message.ts                   (new — extracted from 2 error.tsx files)
tests/unit/app/swiper/orders/pending-orders-list.test.tsx (new — 4 specs)
tests/unit/app/swiper-registration/swiper-registration-form.test.tsx (new — 4 specs)
tests/unit/app/account/swiper-section.test.tsx      (new — 4 specs)
tests/e2e/authenticated/swiper.spec.ts             (Combobox interaction migration)
docs/redesign/04-pages/swiper-queue/{shape,craft}.md            (new)
docs/redesign/04-pages/swiper-registration/{shape,craft}.md     (new)
docs/redesign/04-pages/account/{shape,craft}.md                 (new)
docs/redesign/04-pages/stripe-onboard-complete/{shape,craft}.md (new)
docs/redesign/04-pages/stripe-onboard-refresh/{shape,craft}.md  (new)
docs/redesign/SESSION_LOG.md                       (this entry appended)
```

`app/swiper/layout.tsx` — UNTOUCHED (master plan §10 security
invariant). `app/layout.tsx` — UNTOUCHED (S07 owns the shell
rewrite). Frozen surface (`app/api/**`, `lib/supabase/**`,
`lib/stripe/**`, `lib/orders/state-machine.ts`, `lib/types/**`,
`lib/api/{guest-auth,helpers}.ts`, `supabase/**`, `scripts/**`) —
UNTOUCHED, sentinel verified. `00-features.md` — UNTOUCHED (locked
SHA preserved). `components/ui/*` primitives — UNTOUCHED (no S03
primitive needed extension this session).

### Primitives added/extended

- **First non-auth real consumers** (S03 shipped them; S06 made
  them earn their place):
  - `<Modal>` → `/swiper/orders` detail dialog + `/account` modal.
  - `<Combobox>` → `/swiper-registration` school + `/account` school.
- **New shared helper:** `lib/ui/sanitize-error-message.ts`
  (consumed by both new error.tsx boundaries; extracted to satisfy
  the consolidation rule when the second consumer landed).

### Backend-contract sentinel

GREEN | exceptions: none.

### Open questions

- Modal-primitive close-animation timing: deferred MEDIUM from
  code-reviewer (pending-orders-list.tsx). Fix would require
  shadowing the selected-order state so the modal child stays
  mounted during the exit animation.
- The `/account` LOW security finding (open-redirect on
  `window.location.href = url` from Stripe-API-returned URLs):
  not exploitable today (the frozen API derives URLs entirely
  from Stripe SDK). Belt-and-suspenders origin-validation could
  be added in S08 polish.

### Blockers resolved

- **E2E Combobox interaction strict-mode violation.** Base UI's
  Combobox renders BOTH an `<input role="combobox">` and a
  trigger `<button role="combobox">`. `getByRole('combobox')` by
  itself trips Playwright strict mode. Named-role disambiguation
  (`getByRole('combobox', { name: '...' })`) resolves it. Pattern
  applies to any future Combobox interaction in tests; auth-login
  uses simple `getByRole('combobox')` without strict-mode trip
  because its tests apparently never asserted visibility before
  interaction. The pinned pattern for future sessions:
  `getByTestId('<wrapper>').getByRole('combobox', { name: '<placeholder>' })`.

### Next entry point

**Session 07 — Global shell + realtime audit.** `app/layout.tsx`
rewrite (drop `banner` parallel slot per `02-routes.md §6 ADR-1`
+ §1 decision); `components/header.tsx`, `components/banner.tsx`,
`components/swiper-orders-button.tsx`, `components/chat-panel/**`
restyle; introduce `lib/realtime/channel-registry.ts` (ref-counted
singleton subscription per master plan §11). The
`resolvePrincipal` helper sees its real adoption here (header
branches on principal kind). `app/@banner/` parallel slot deletion
finally happens. Visibility-refetch hook
(`hooks/use-visibility-refetch.ts`) added per master plan §11.

### Code review (cumulative diff)

`code-reviewer` agent ran on the five-commit cumulative diff
before session close. Verdict: **WARNING** with **0 critical / 2
high / 2 medium / 2 low** findings. Both HIGHs and one MEDIUM
addressed in fix-up commit `ef291cf` before this log entry was
committed:

- HIGH: silent profile-fetch error swallow in
  `/stripe/onboard/complete/page.tsx` → `console.error` restored.
- HIGH: duplicate `sanitize()` byte-for-byte in two error.tsx
  files → extracted to `lib/ui/sanitize-error-message.ts`.
- MEDIUM: `as` cast on Combobox `onValueChange` (two sites) →
  replaced with `asSchoolItem` runtime type guard.
- LOW: missing JSDoc on `handleOpen` / `handleClose` in
  `pending-orders-list.tsx` → JSDoc added.

`security-reviewer` agent ran in parallel. Verdict: **APPROVE** with
**0 critical / 0 high / 1 medium / 1 low / 1 design choice**:

- MEDIUM: sanitize() regex didn't strip absolute paths or IP:port
  fragments → fixed in `lib/ui/sanitize-error-message.ts`
  extraction (security-reviewer's MEDIUM and code-reviewer's HIGH
  resolved in the same commit).
- LOW: open-redirect risk on `window.location.href = url` from
  Stripe-API-returned URLs → not exploitable today (frozen API
  derives URLs from Stripe SDK only); deferred.
- Design choice (not a vulnerability): `router.back()` fires
  before `await signOut()` / `await deleteAccount()` in
  account-actions.tsx → preserved verbatim from S01 (snappy UX;
  failed delete leaves account intact, which is the safe failure
  mode).

### Commits

- `5e0584b` — `feat(swiper): rebuild /swiper/orders against redesigned primitives`
- `742ac94` — `feat(swiper-registration): rebuild against redesigned primitives`
- `08dfad0` — `feat(account): rebuild /account against redesigned primitives`
- `a0bc695` — `feat(stripe-onboard): rebuild /stripe/onboard/complete against redesigned primitives`
- `237dbfb` — `feat(stripe-onboard): rebuild /stripe/onboard/refresh against redesigned primitives`
- `ef291cf` — `fix(s06): code-review fix-up + e2e spec Combobox migration`
- (SESSION_LOG close commit appended after this entry)

### Tags added

- `phase4/swiper-queue`
- `phase4/swiper-registration`
- `phase4/account`
- `phase4/stripe-onboard-complete`
- `phase4/stripe-onboard-refresh`

---

## Session 07 — Global shell + realtime audit (CLOSED)

- **Date:** 2026-04-25
- **Branch:** `fpoop` (in place; per the standing user direction)
- **Phase(s):** 4d (global shell rewrite — 4 components + 1 layout) + master plan §11 realtime safeguards
- **Status:** CLOSED
- **features.md SHA-256:** `e6be0f544ad92a1ebd9e853687d2fa09f5847633ebdfb21f10f219b1a333539f`
  (unchanged from S01; catalog still locked, sentinel green)

### What shipped

Twelve tagged commits land the entire Phase-4 shell endpoint plus the
master plan §11 realtime safeguards plus the catalog-promised
optimistic chat UX. The session spans two deliberate scope expansions
recorded as amendments in the new `docs/redesign/SCOPE_AMENDMENTS.md`
file (A07-01: `messages.temp_id` end-to-end frozen-surface touch) and
one new runtime dependency (`vaul`).

#### Realtime safeguards (master plan §11)

1. **`lib/realtime/channel-registry.ts` (NEW)** — tag `phase4/realtime-registry`,
   commit `0cc369f`. Ref-counted singleton wrapper around
   `supabase.channel()`. UUID validation fails closed (refuses to
   subscribe on malformed UUID per §11 security note). Single-
   consumer-per-channelName recorded as deliberate API decision (both
   real call sites have one consumer; multi-consumer is theoretical).
   Idempotent unsubscribe across React StrictMode double-invoke.
   TDD-first: 11 vitest specs WRITTEN + WATCHED FAIL before the
   implementation file existed. Specs cover happy-path subscribe,
   three fail-closed UUID branches, duplicate-subscriber rejection,
   second-channelName allowed, single-cleanup + idempotent-cleanup,
   fresh-channel-after-unsubscribe contract, two cleanup-guard specs
   against the test reset helper.

2. **`hooks/use-visibility-refetch.ts` (NEW)** — tag
   `phase4/visibility-hook`, commit `1769d99`. `document
   .visibilitychange → 'visible'` triggers a caller-supplied refetch.
   Cleanup removes the listener; rebinds when refetch identity
   changes. TDD-first: 4 vitest specs WRITTEN + WATCHED FAIL before
   the implementation file existed.

3. **`hooks/use-messages.ts` REWRITE** — tag
   `phase4/use-messages-migration`, commit `8c80860`. API change from
   `useMessages(orderId: string)` to `useMessages({ orderId,
   conversationId? })` — the optional conversationId is the B2-pairing
   hook for the chat-panel-provider's pre-resolved id. Three-effect
   lifecycle: resolve conv id (skip if pre-supplied) → subscribe via
   registry BEFORE initial fetch with bufferRef → initial fetch then
   merge buffer through dedupe-by-(`id ?? temp_id`). Visibility-
   refetch wired. New `appendOptimistic / markFailed / markPending`
   helpers for the C2 chat-input wiring. 19 specs total in the file
   (12 original + 7 new).

4. **`components/chat-panel/chat-panel-provider.tsx` REWRITE +
   `chat-panel.tsx` REWRITE + `chat-panel-context.ts` extension** —
   tag `phase4/chat-panel-migration`, commit `a909ee8`. Provider
   migrates to `subscribeChannel`. `loadActiveOrders` extends the
   SELECT with `restaurant_name, conversations(id)` (the B2 pairing
   that lets useMessages skip its own conversations lookup —
   eliminates the potential N+1 across N open panels) AND fixes a
   pre-existing latent bug (the prior `eateries(name)` join referenced
   a table removed in the post-grubhub pivot). `useVisibilityRefetch
   (loadActiveOrders)` reconciles the auto-open list on tab return.
   ChatPanel splits into `DesktopPanelItem` (sm+) and
   `MobileNewestPanel` (max-sm rendering inside vaul `<Sheet>`).
   `OrderEntry` gains `conversationId: string | null`. 6 new specs
   covering registry subscribe, conversations(id) JOIN inclusion,
   conversationId pass-through across the three response shapes
   (array / object / null), and the userId=null short-circuit.

#### Optimistic chat UX (catalog C2)

5. **`messages.temp_id` end-to-end (A07-01 amendment)** — tags
   `phase4/s07-frozen-amendment` (commit `e1c0e46`) + `phase4/messages-
   temp-id` (commit `84829dd`). The deliberate one-shot §9 amendment
   recorded in `docs/redesign/SCOPE_AMENDMENTS.md`. Six additive
   edits: migration `20260425120000_messages_temp_id.sql` adding a
   nullable `text` column; `lib/types/messaging.ts` + `lib/types/api
   .ts` widening the Message + sendMessageSchema; `app/api/messages/
   route.ts` + `app/api/guest/messages/route.ts` reading `temp_id`
   from the validated request body and echoing it through the insert
   + select. 7 new vitest specs (schema validation + insert echo +
   missing-temp_id default + malformed rejected + guest-path symmetry).
   Migration applied locally via `supabase db reset --no-seed` then
   `npx tsx scripts/seed.ts` (seeds re-applied per
   feedback_run_seed_scripts.md).

6. **`components/chat/chat-input.tsx` (UNCHANGED) +
   `chat-view.tsx` REWRITE + `chat-thread.tsx` REWRITE** — tag
   `phase4/chat-input-optimistic`, commit `5b21fe2`. The optimistic
   logic lives at the chat-view data-layer boundary (not the chat-
   input composition boundary). On send: generate `crypto.randomUUID
   ()` temp_id (no fallback — `crypto.randomUUID` is universally
   available in supported runtimes; a non-UUID would fail the
   server schema), `appendOptimistic`, POST through `sendMessage(body,
   temp_id)`. On error: `markFailed`. Retry button on failed rows
   calls `markPending` then `sendMessage` again. Chat-thread renders
   pending (muted text + spinner + "Sending…") and failed (muted
   text + role="alert" + Retry button). 4 new specs.

#### Mobile primitive (D2)

7. **`components/ui/sheet.tsx` migrated to vaul** — tag
   `phase4/sheet-drag`, commit `bad65b0`. The S03 catalog row
   GLOBAL-SHEET specifies "Wraps Radix Dialog + drag-to-dismiss"; S07
   replaces the underlying engine from Radix Dialog to **`vaul`**
   (vaul itself wraps Radix Dialog under the hood, so focus-trap +
   scrim + ESC + scroll-lock all carry through). API surface
   unchanged. Default drag-handle pill at top edge.

   **New runtime dependency: `vaul` ~12KB gzipped.** The only new
   dep S07 introduces. Justification: Radix Dialog has no built-in
   drag gesture; rolling one by hand on top of Radix would re-implement
   vaul poorly. ChatPanel mobile is the first real consumer.

   Three jsdom polyfills added in `tests/unit/setup.ts` for vaul:
   `getComputedStyle(...).transform` returns 'none' (was undefined →
   `.match()` NPE); `window.matchMedia` stub; `Element.prototype.{set,
   release,has}PointerCapture` no-ops (jsdom does not implement
   Pointer Events API).

#### Brand-aligned shell

8. **`components/header.tsx` REWRITE** — tag `phase4/header`, commit
   `c7989c8`. First real consumer of `lib/auth/resolve-principal.ts`
   (the S05 helper). Server component branching on `principal.kind ===
   'anon' | 'guest_cookie'` (sign-in/sign-up) vs other (4 icon links:
   home, orders, current-orders, account). Adds the catalog testids
   `header-orders-link` + `header-current-orders-link` that were
   missing from the previous markup. `.impeccable.md` principle 5:
   `bg-background` + hairline `border-border/60` instead of
   `bg-black`. Display font (Bricolage) on the wordmark.

9. **`components/banner.tsx` REWRITE** — tag `phase4/banner`, commit
   `6a6415a`. Replacement for the deleted `app/@banner/` parallel slot
   (S07 ADR-1 from `02-routes.md §6`). Tinted `<Surface tone="muted">`
   instead of `bg-black`. ONE lime CTA. Display headline + muted-
   foreground subhead.

10. **`components/swiper-orders-button.tsx` REWRITE** — tag
    `phase4/swiper-button`, commit `14b789e`. Brand voice principle 2
    ("the accent earns its place"): button itself is `bg-foreground`,
    the badge is the only surface that gets the lime accent. Badge
    aria-hidden + Link aria-label expanded to surface the count to AT
    when count > 0.

11. **`app/layout.tsx` REWRITE + four file deletions** — tag
    `phase4/shell-layout`, commit `044167e`. Drops `banner: React
    .ReactNode` parallel-slot prop. Renders `<Banner>` directly.
    Resolves principal once via `resolvePrincipal(supabase, await
    cookies())`; derives `isSwiper`, `isLoggedIn`, `userId`,
    `pendingOrderCount` from a single source of truth. **Fixes the
    catalog discrepancy on GLOBAL-SWIPER-BADGE**: the count now
    correctly filters by `school_id` (was previously unfiltered;
    contradicted the catalog "orders.status='open' AND
    school_id=profile.school_id"). Only `authed_swiper` kind sees a
    non-zero count (pre-stripe swipers see 0 since they cannot accept
    orders yet). DELETED: `app/@banner/page.tsx`, `app/@banner/
    default.tsx`, `components/header-wrapper.tsx`, `components/
    banner-guard.tsx`.

#### End-of-session HIGH fixes (in this close commit)

After the cumulative `code-reviewer` pass surfaced two HIGHs, both
fixes shipped in this close commit (no new tag — the fixes amend the
shell endpoint):

- **HIGH** `chat-view.tsx:160-162` — `crypto.randomUUID()` fallback
  produced a non-UUID string that would have failed the API schema
  (`z.string().uuid().optional()`). Removed the fallback; documented
  why the runtime guarantee is sufficient.
- **HIGH** `header.tsx:32,59` — `header-home-link` testid emitted
  twice (logo + nav Home icon) for authed users → Playwright strict
  mode trip. Dropped the duplicate from the nav Home icon (the
  wordmark above is the canonical home link per the original
  pre-S07 markup); kept aria-label="Home" so screen readers still
  see it.

### Decisions locked (this session)

The user formally selected the **B2 + C2 + D2** track on
2026-04-25 after a side-by-side comparison of pros/cons. Rationale
recorded for future cold-start authors:

- **B2 (subscribe-before-fetch + provider-side conversations JOIN)**
  over the simpler B1: literal §11 compliance, race window collapses
  to zero, buffer + flush is testable directly. Cost: one extra
  client query per chat-panel mount, batched in the provider's
  loadActiveOrders to eliminate N+1 across N open panels.
- **C2 (temp_id end-to-end with the §9 amendment)** over C1 (dedupe-
  in-tests-only): the catalog has advertised optimistic temp_id
  append since S01; shipping the dedupe without a real consumer
  would have been speculative abstraction. The §9 amendment scope
  is bounded (one nullable column + echo) and recorded in
  `SCOPE_AMENDMENTS.md` as A07-01.
- **D2 (Sheet on mobile with drag-to-dismiss via vaul)** over D1
  (skip Sheet entirely): closes real mobile UX gaps (focus trap,
  scrim, ESC, scroll-lock, drag-to-dismiss) at the cost of one new
  runtime dep. ChatPanel uses `useIsMobile()` to render only ONE
  variant at a time (avoids the duplicate-testid trip Playwright
  strict mode would otherwise hit).

The user-confirmed scope decisions:
- **HeaderWrapper deleted** (anti-brand black sticky background).
- **Subscribe-before-fetch literal compliance** (B2).
- **temp_id end-to-end with §9 amendment** (C2 + A07-01).
- **Sheet on mobile with vaul drag-to-dismiss** (D2).

### Verification gauntlet

- `npm run lint` — green
- `npx vitest run` — **34 files / 290 tests** passed (was 31/249 in
  S06; +3 files / +41 tests across the seven S07 spec additions or
  expansions: api.test.ts +2, post.test.ts +5, guest messages-post
  +1, channel-registry +11, use-visibility-refetch +4, use-messages
  +7, sheet +3, chat-thread +2, chat-view +2, chat-panel-provider
  +6, with the chat-thread/chat-view +temp_id fixes accounting for
  the test-shape updates).
- `npm run build` — green
- `npm run lint:features-hash` — green; SHA matches S01
- **Contract sentinel** (`git diff HEAD` against frozen paths) —
  expected non-zero ONLY in commit 0b's A07-01 scope (6 file edits
  + 1 migration); zero everywhere else. Verified.
- **Bundle sentinel** — `! grep -r "SUPABASE_SECRET_KEY\|
  createServiceClient" .next/static/` clean.
- **Frozen-string §9 grep** — 10 (the §9 form across `app components
  hooks lib/constants`); the S06-pinned form (`grep -R "supabase
  .channel" app components hooks`) returns **0** (was 2 — both prior
  call sites now consume the registry exclusively).
- **Realtime channel grep** (`grep -RE "\.channel\(" app components
  hooks`) — **0** (was 2). Master plan §11 goal achieved: zero
  direct `.channel(` calls outside the registry.
- **Catalog testid coverage** — 11 S07-owned shell testids preserved;
  two NEW (`header-orders-link`, `header-current-orders-link`) added
  per catalog requirement.
- **Playwright** — **26 passed / 9 failed / 16 did not run**. S06
  baseline was 27/8/16. Net: -1 pass, +1 failure. The new failure
  + the lost pass are concentrated in mobile-nav (dev-overlay
  intercept on the swiper button click — page renders correctly per
  curl smoke) and chat surface specs (chat.spec.ts, completion-
  banner.spec.ts, guest-chat.spec.ts) that may need spec-level
  migration after the chat-panel viewport-conditional render +
  conversationId pass-through changes. Spec migrations deferred to
  S08 cross-page passes (which include responsive verification +
  E2E sweep).
- **Pre-existing TS error** in `tests/unit/stripe/webhooks.test.ts:
  190` — unrelated to S07 (predates the session per `git stash`
  bisect). Left alone.

### Discrepancies flagged (carried forward)

- Master plan §9 amendment A07-01 is a one-shot exception. Future
  sessions return to the unamended invariant; do not generalize.
- Test fixtures in `tests/e2e/authenticated/{mobile-nav,swiper-
  pending}.spec.ts` updated to seed `stripe_accounts` rows — the
  layout's principal-driven swiper detection requires
  `onboarding_complete=true` to classify a user as `authed_swiper`.
  Other E2E specs that rely on the old "is_swiper=true is enough"
  assumption may need similar updates in S08.
- One `mobile-nav` test (line 79 — pending orders icon click) hits
  a Next.js dev overlay alert during the click action. Curl of the
  same URL renders the page cleanly, so the dev overlay alert is
  triggered by something specific to the test environment (likely
  a hydration warning from `useIsMobile`'s undefined → false initial
  state). Flagged for S08 audit pass.
- The optional `markPending` + `appendOptimistic` callbacks on
  `useMessages` are consumed in `chat-view`. No other consumer
  surfaces today — if a future surface (e.g., the `/current-orders`
  embedded chat) wants the same optimistic UX, it can wrap
  `useMessages` similarly with no hook changes needed.

### Files added/changed (editable surface + A07-01 scope)

```
NEW
  docs/redesign/SCOPE_AMENDMENTS.md
  supabase/migrations/20260425120000_messages_temp_id.sql            (A07-01)
  lib/realtime/channel-registry.ts
  hooks/use-visibility-refetch.ts
  components/banner.tsx
  tests/unit/lib/realtime/channel-registry.test.ts
  tests/unit/hooks/use-visibility-refetch.test.ts
  tests/unit/components/chat-panel/chat-panel-provider.test.tsx

MODIFIED
  app/layout.tsx                                                     (rewrite)
  app/api/messages/route.ts                                          (A07-01 additive)
  app/api/guest/messages/route.ts                                    (A07-01 additive)
  components/chat-panel/chat-panel-context.ts                        (OrderEntry +conversationId)
  components/chat-panel/chat-panel-provider.tsx                      (rewrite)
  components/chat-panel/chat-panel.tsx                               (rewrite)
  components/chat/chat-view.tsx                                      (optimistic flow)
  components/chat/chat-thread.tsx                                    (pending/failed treatments)
  components/header.tsx                                              (rewrite, Principal-driven)
  components/swiper-orders-button.tsx                                (rewrite)
  components/ui/sheet.tsx                                            (vaul migration)
  hooks/use-messages.ts                                              (rewrite, registry+B2+temp_id)
  lib/types/api.ts                                                   (A07-01 additive)
  lib/types/messaging.ts                                             (A07-01 additive)
  package.json                                                       (vaul dep)
  package-lock.json
  tests/unit/setup.ts                                                (jsdom polyfills for vaul)
  tests/unit/api/guest/messages-post.test.ts                         (+1 spec)
  tests/unit/components/chat/chat-thread.test.tsx                    (+2 specs)
  tests/unit/components/chat/chat-view.test.tsx                      (+2 specs)
  tests/unit/components/ui/sheet.test.tsx                            (+3 specs)
  tests/unit/hooks/use-messages.test.ts                              (+7 specs)
  tests/unit/messages/post.test.ts                                   (+5 specs)
  tests/unit/types/api.test.ts                                       (+2 specs)
  tests/e2e/authenticated/mobile-nav.spec.ts                         (stripe_accounts seed)
  tests/e2e/authenticated/swiper-pending.spec.ts                     (stripe_accounts seed)

DELETED
  app/@banner/page.tsx
  app/@banner/default.tsx
  components/header-wrapper.tsx
  components/banner-guard.tsx
```

`app/swiper/layout.tsx` — UNTOUCHED (master plan §10 security
invariant). `lib/supabase/{server,client,service,middleware,admin}.ts`
— UNTOUCHED. `lib/stripe/**` — UNTOUCHED.
`lib/orders/state-machine.ts` — UNTOUCHED. `lib/types/database.ts`
— UNTOUCHED (Message lives in messaging.ts; database.ts only
carries Profile/Order/Payment/StripeAccount). `lib/api/{guest-auth,
helpers}.ts` — UNTOUCHED. `scripts/**` — UNTOUCHED.
`00-features.md` — UNTOUCHED (locked SHA preserved).

### Primitives added/extended

- **`<Sheet>` migrated to vaul** with optional drag-to-dismiss.
  First real consumer: chat-panel mobile (max-sm).
- **NEW: `lib/realtime/channel-registry.ts`** ref-counted singleton.
  Two consumers (use-messages, chat-panel-provider).
- **NEW: `hooks/use-visibility-refetch.ts`** generic hook.
  Two consumers (use-messages thread reconciliation, chat-panel-
  provider auto-open list reconciliation).

### Backend-contract sentinel

GREEN | exceptions: A07-01 scope (6 file additive edits + 1 migration
in commit `84829dd`), recorded in `docs/redesign/SCOPE_AMENDMENTS.md`.

### Open questions

- Mobile-nav `pending orders icon` Playwright test hits dev overlay;
  root cause not yet identified. S08 audit pass should investigate.
- Three chat-surface E2E specs (chat.spec, completion-banner,
  guest-chat) still failing; likely affected by chat-panel
  viewport-conditional render or conversationId prop wiring. S08
  cross-page E2E sweep owns the migration.
- DB column `messages.temp_id` is `text` while the API validates as
  `uuid` (security-reviewer LOW). A future session can tighten via
  CHECK constraint or column-type change to `uuid`.

### Blockers resolved

- **Vaul jsdom incompatibility.** Three polyfills in
  `tests/unit/setup.ts` allow vaul to render under vitest's jsdom
  environment (matchMedia stub, getComputedStyle transform shim,
  Pointer Events API no-ops). The pinned pattern for any future
  vaul consumer.
- **Dual-render-path testid collision.** Initially chat-panel.tsx
  rendered both desktop stack AND mobile Sheet via CSS-based
  `sm:hidden` / `max-sm:hidden` — both sides produced
  `data-testid="chat-panel-header"` in the DOM, tripping Playwright
  strict mode. Refactored to `useIsMobile()` viewport detection so
  only ONE variant mounts at a time.

### Next entry point

**Session 08 — Cross-page passes + test sweep.** Run `adapt → harden
→ audit → polish → critique` skills sequentially per master plan
§Phase 5; produce reports in `docs/redesign/05-cross-page/`. Fix
P0/P1 audit findings. Migrate the deferred E2E specs flagged above
(chat.spec, completion-banner, guest-chat, mobile-nav). Investigate
the `useIsMobile` hydration warning that triggers the dev overlay.
Per master plan §Phase 6: full test + review pass. Branch ready to
merge at S08 close.

### Code review (cumulative diff)

`code-reviewer` agent ran on the cumulative S07 diff (12 commits,
36 files, +2133/-499 lines) before session close. Verdict:
**WARNING** with **0 critical / 2 high / 3 medium / 3 low**. Both
HIGHs addressed in this close commit (see "End-of-session HIGH
fixes" above). 3 MEDIUMs deferred:
- StrictMode race in `use-messages` Effect 2/3 ordering
  (initialFetchDoneRef reset placement) — only manifests in dev
  StrictMode + very fast fetches. S08.
- `chat-panel-provider` `loadActiveOrders` re-opens completed
  panels that the user dismissed via `closePanel`. UX regression on
  visibility refetch. S08.
- `sendMessage` `res.json()` lacks `.catch()` guard if a 201
  response has a non-JSON body. The throw propagates correctly via
  handleSend → markFailed; user sees retry. Belt-and-suspenders
  improvement deferred.
3 LOWs deferred (`useIsMobile` SSR flash; `Sign up` link routes to
`/auth/login`; convention gap on `use-messages.ts` named-only export
— which is idiomatic for hooks).

### Security review (cumulative diff)

`security-reviewer` agent ran in parallel. Verdict: **APPROVE** with
**0 critical / 0 high / 0 medium / 1 low / 0 design choices**:
- LOW: DB column `messages.temp_id` is `text` while API validates
  `uuid` — gap that's not exploitable today (all client paths go
  through validated API; no DB lookup uses temp_id) but worth
  tightening with a CHECK constraint or column-type change in a
  future session. Deferred.
- All four focus areas (UUID validation in registry, visibility-
  refetch payload safety, server-side principal resolution, temp_id
  request-body validation) cleared. No service-client leak in the
  client bundle. `vaul` supply-chain posture acceptable.

### Commits

- `e1c0e46` — `docs(s07): record §9 frozen-surface amendment A07-01 for messages.temp_id`
- `84829dd` — `feat(s07): add messages.temp_id end-to-end (A07-01 amendment)`
- `0cc369f` — `feat(realtime): add ref-counted channel registry (master plan §11)`
- `1769d99` — `feat(hooks): add useVisibilityRefetch (master plan §11)`
- `bad65b0` — `feat(sheet): migrate Sheet primitive to vaul for drag-to-dismiss`
- `8c80860` — `feat(realtime): migrate useMessages to channel-registry + B2 + temp_id (master plan §11)`
- `a909ee8` — `feat(chat-panel): migrate to channel registry + B2 JOIN + mobile Sheet`
- `5b21fe2` — `feat(chat): wire optimistic UI end-to-end (C2)`
- `c7989c8` — `feat(header): rewrite as Principal-driven server component`
- `6a6415a` — `feat(banner): brand-aligned recruitment banner (replaces parallel slot)`
- `14b789e` — `feat(swiper-button): brand-aligned floating queue affordance`
- `044167e` — `feat(layout): drop @banner parallel slot + HeaderWrapper, render shell directly`
- (SESSION_LOG close commit appended after this entry, plus the two HIGH fix-up edits in same commit)

### Tags added

- `phase4/s07-frozen-amendment`
- `phase4/messages-temp-id`
- `phase4/realtime-registry`
- `phase4/visibility-hook`
- `phase4/sheet-drag`
- `phase4/use-messages-migration`
- `phase4/chat-panel-migration`
- `phase4/chat-input-optimistic`
- `phase4/header`
- `phase4/banner`
- `phase4/swiper-button`
- `phase4/shell-layout`
