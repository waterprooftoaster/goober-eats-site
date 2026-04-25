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

- `27094f3` — `feat(design): session 03 — OKLCH theme + Bricolage/Figtree fonts + ui primitives`

### Tags added

None this session.
