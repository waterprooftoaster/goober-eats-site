# `/account` — Craft

## Anatomy

```
<main data-testid="account-page" sr-only>  ← portal sentinel
  <Modal open onOpenChange={(o) => !o && router.back()}>
    <ModalContent data-testid="account-modal" max-w-sm gap-5>
      <ModalTitle>Account</ModalTitle>
      <p data-testid="account-email-display" text-muted-foreground />

      <AccountActions>
        <Button variant="subtle" asChild><Link href="/orders">My orders</Link></Button>
        <Button variant="ghost" data-testid="account-signout-button">Sign out</Button>
        {!confirming ? (
          <Button variant="ghost" text-destructive data-testid="account-delete-button">
            Delete account
          </Button>
        ) : (
          <div border-destructive/30 bg-destructive/5>
            <p />  ← "Are you sure?…"
            {error && <p role="alert" />}
            <Button variant="primary" bg-destructive>Yes, delete</Button>
            <Button variant="subtle">Cancel</Button>
          </div>
        )}
      </AccountActions>

      <SwiperSection>
        {/* non-swiper branch */}
        <div border-t border-border>
          <h2>Become a swiper</h2>
          <p />
          <Button variant="primary" asChild>
            <Link data-testid="account-become-swiper-cta" href="/swiper-registration" />
          </Button>
        </div>

        {/* swiper-active branch */}
        <SwiperStatus>
          <h2>Swiper</h2>
          <span bg-primary/15>Active</span>

          {error && <p role="alert" />}
          {schoolSavedMsg && <p role="status">School saved.</p>}

          <p>School</p>
          {!changingSchool ? (
            <span>{currentSchool.name}</span>
            <Button variant="ghost">Change</Button>
          ) : (
            <div data-testid="account-school-selector">
              <Combobox><ComboboxInput /><ComboboxContent>...</></.>
            </div>
            <Button variant="subtle" data-testid="account-school-save-button">Save school</Button>
            <Button variant="ghost">Cancel</Button>
          )}

          <p>Payment account</p>
          {stripeConnected ? (
            <span data-testid="account-stripe-status" bg-primary/15>Connected</span>
            <Button variant="ghost"
                    data-testid="account-stripe-dashboard-button"
                    onClick={() => POST /api/stripe/connect/dashboard}>
              Open dashboard
            </Button>
          ) : (
            <span data-testid="account-stripe-status" bg-muted>Pending</span>
            <Button variant="primary"
                    data-testid="account-stripe-link-button"
                    onClick={() => POST /api/stripe/connect}>
              Complete payment setup
            </Button>
          )}
        </SwiperStatus>
      </SwiperSection>
    </ModalContent>
  </Modal>
</main>
```

## Decisions

- **Modal-as-route, not modal-as-parallel-slot.** Confirmed in
  `02-routes.md §6 ADR-2`. Trade-off: a parallel slot would persist the
  underlying page underneath, but every flow that lands on /account
  fetches dynamic data anyway, and deep-linking + back-button work
  naturally with route-backed.
- **`router.back()` on close, not `router.push('/')`.** Preserves the
  history stack the user just walked through (e.g. they came from
  /orders → /account → close should return to /orders, not /).
- **`sr-only` `<main data-testid="account-page">` sentinel.** The
  Modal portals its content out of the page tree, so the catalog
  `account-page` testid would otherwise have no DOM target during
  visual smoke or `getByTestId` lookups. The sr-only `<main>`
  provides one without affecting layout.
- **Three primary lime CTAs across the three swiper-section states**
  — never more than one visible at once:
  - non-swiper: "Get started" become-swiper.
  - swiper-pending-stripe: "Complete payment setup".
  - swiper-active: (none lime; "Open dashboard" is ghost).
  This satisfies the brand "one lime per screen" rule across all
  branches.
- **`<Button asChild>` for routed links.** Lets `<Link href>`
  inherit primitive styling + a11y without nested clickables.
- **Combobox swap on the school selector** (same reasoning as
  /swiper-registration). Dual-input pattern preserved.
- **Bug fix: `account-stripe-dashboard-button` POSTs to
  `/api/stripe/connect/dashboard`** (matches catalog
  SWIP-ACCOUNT-STRIPE-DASHBOARD `backend_contract`). Old code POSTed
  to `/api/stripe/connect` (relink); pre-existing drift from S01.
  Caught during the rebuild because the redesigner read the catalog.
  Logged in SESSION_LOG.
- **Status pills use brand tints** — `bg-primary/15` for "Active" and
  "Connected" (lime tint, ~15% opacity); `bg-muted` for "Pending".
  No `bg-green-100` / `bg-yellow-100`.
- **Delete-confirm panel is a distinct destructive-tinted row** with
  `border-destructive/30 bg-destructive/5` so it stays visually
  contained inside the modal. The "Yes, delete" button uses
  `bg-destructive` instead of `bg-primary` so the lime CTA invariant
  isn't violated by a delete action.
- **`text-destructive` `role="alert"` everywhere.**
- **Sign out / Delete are `variant="ghost"`** — they're destructive
  affordances, but secondary; ghost lets them sit visually below the
  primary CTAs.

## Behavior preserved (byte-for-byte from S01)

- AccountActions: `router.back()` BEFORE awaiting `signOut()` /
  `deleteAccount()` (S01 pattern; the redirect happens before the
  network round-trip completes for snappier UX).
- Two-step delete: `setConfirming(true)` then a separate "Yes, delete"
  click → `deleteAccount()`. Cancel resets state.
- SwiperSection branches on `profile.is_swiper`.
- SwiperStatus: school change is opt-in (Change → Combobox → Save).
- After Save: `setSchoolSavedMsg(true)` + 3s `setTimeout` clear +
  `router.refresh()` to re-fetch profile data.
- Stripe-relink redirect: `window.location.href = url` (hard nav).
- Page-level: parallel fetch of profile + stripe + schools; missing
  profile falls through to `{ is_swiper: false, school_id: null }`.

## Testid coverage

All 11 catalog testids preserved. The school save button gets a
non-catalog `account-school-save-button` testid that already lived in
S01 markup.

## A11y

- Modal: Radix Dialog (focus trap + Escape + return-focus +
  scroll-lock + aria-modal/labelledby).
- Combobox: Base UI roles + arrow-key navigation.
- Buttons: real `<button>` with focus-visible rings.
- `role="alert"` (errors) / `role="status"` (school-saved
  affirmation).
- Delete: confirmation row visually distinct (destructive tint) and
  Cancel button has equal weight to "Yes, delete".

## File hygiene

- `account-panel.tsx`: 60 LOC (was 73; -13 from removing the hand-
  rolled overlay markup).
- `account-actions.tsx`: 99 LOC (was 98; +1 net from primitive
  imports).
- `swiper-section.tsx`: 234 LOC (was 213; +21 for Combobox imports +
  the dual-input wrapper + the `handleStripeAction(endpoint)`
  consolidation that replaces two near-duplicate handlers).
- `page.tsx`: 47 LOC (was 53; -6 from removing trailing
  `select('id, name').order('name')` formatting).
- JSDoc headers on all four files. Default export first; helpers
  below `// --- Helpers ---` separator.

## Vitest specs

`tests/unit/app/account/swiper-section.test.tsx` (4 specs, TDD-first):

1. School Save button soft-disables while PATCH is in flight; settles
   after server resolves; calls `router.refresh()` on success.
2. Dashboard button POSTs to **`/api/stripe/connect/dashboard`**
   (catalog SWIP-ACCOUNT-STRIPE-DASHBOARD) — this spec FAILED
   against pre-rebuild code (drift from catalog) and PASSES after
   rebuild (drift fixed).
3. Link button POSTs to `/api/stripe/connect` when onboarding is
   incomplete.
4. Non-swiper branch renders the become-swiper CTA pointing at
   `/swiper-registration`.
