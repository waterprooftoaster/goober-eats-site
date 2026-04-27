# Route Tree ADR (Phase 2)

> Decision register for the redesigned `app/` shell. Produced in Session 02
> from the locked feature catalog ([`00-features.md`](./00-features.md)) and
> the master plan §Phase 2.

## 1. Decision register

Every current `app/**/page.tsx`, `app/**/layout.tsx`, parallel-slot, and
user-facing `app/auth/callback/route.ts`. `app/api/**` lives in §5 (frozen
backend surface) and is not part of the URL-redesign decision space.

| Current path | Type | Decision | Rationale (feature IDs) | Migration notes |
|--------------|------|----------|-------------------------|-----------------|
| `app/layout.tsx` | layout | **keep, restructure** | GLOBAL-LAYOUT-ROOT, GLOBAL-FONTS, GLOBAL-SESSION-REFRESH; hosts GLOBAL-HEADER-*, GLOBAL-BANNER-*, GLOBAL-SWIPER-BUTTON/BADGE, GLOBAL-CHATPANEL-* | Session 07: drop the `banner: React.ReactNode` parallel-slot prop and render `<Banner>` directly. Add `app/fonts.ts` (next/font for Bricolage Grotesque + Figtree) per master plan §3. Add top-level `loading.tsx` / `error.tsx` / `not-found.tsx` (Session 03). |
| `app/page.tsx` | page | **keep** | ORD-HOME-LOAD, ORD-HOME-FILE-SELECT, ORD-HOME-THUMBNAIL-STRIP, ORD-HOME-UPLOAD, ORD-HOME-PLACE-ORDER-CTA, ORD-HOME-UPLOAD-ERROR | Currently `'use client'` — preserves drag-and-drop + sessionStorage. Session 04 redesign within file. |
| `app/@banner/page.tsx` | parallel-slot page | **delete** | GLOBAL-BANNER-BECOME, GLOBAL-BANNER-HIDDEN | Session 07: delete with `app/@banner/default.tsx`. Replacement is `components/banner.tsx` (Session 01 untracked file) rendered directly in `app/layout.tsx`. Master plan §Decisions locked: "no parallel routes." Banner conditional-null logic (`pathname !== '/' || isSwiper`) moves to `<Banner>` itself. |
| `app/@banner/default.tsx` | parallel-slot fallback | **delete** | (none — supports the parallel slot) | Same as above. |
| `app/checkout/page.tsx` | page | **keep** | ORD-CHECKOUT-LOAD, ORD-CHECKOUT-CART-PREVIEW, ORD-CHECKOUT-FORM-GUEST, ORD-CHECKOUT-FORM-AUTHED, ORD-CHECKOUT-CREATE-SESSION, ORD-CHECKOUT-EMBEDDED, ORD-CHECKOUT-ERROR, ORD-CHECKOUT-BACK | Currently `'use client'` — required for `@stripe/react-stripe-js EmbeddedCheckout` mount. Stays client. Add colocated `error.tsx`. |
| `app/checkout/return/page.tsx` | page | **keep** | ORD-CHECKOUT-RETURN-LOAD, ORD-CHECKOUT-RETURN-GUEST, ORD-CHECKOUT-RETURN-AUTHED, ORD-CHECKOUT-RETURN-INVALID | Server component; reads `session_id` query, calls Stripe SDK to look up `payment_intent`, branches on `metadata.is_guest`. Add colocated `error.tsx` (handles Stripe-SDK lookup failures distinctly from global error boundary). |
| `app/orders/page.tsx` | page | **keep** | ORD-ORDERS-LOAD, ORD-ORDERS-LIST, ORD-ORDERS-EMPTY | Server component; parallel fetch by `orderer_id` + `swiper_id`. No realtime — static history. |
| `app/current-orders/page.tsx` | page | **keep** | ORD-CURRENT-LOAD, ORD-CURRENT-LIST, ORD-CURRENT-EMPTY, ORD-CURRENT-STATUS-BADGE | Server-side initial fetch; client-side `current-orders-list.tsx` hosts ChatView and subscribes to realtime status. Add colocated `error.tsx` (realtime channel failures distinct). |
| `app/auth/login/page.tsx` | page | **keep** | AUTH-LOGIN-LOAD + every other AUTH-LOGIN-* | Server component prefetches schools; delegates to client `login-form.tsx`. Multi-step state machine stays inside the form. Onboarding-resume sub-branch is internal — no new route. |
| `app/auth/callback/route.ts` | route handler | **keep, frozen** | (server-only OAuth landing) | Listed in §5 even though it's an `app/auth/...` path because it's a `route.ts` and master plan §9 freezes `app/api/**`. This sibling auth callback under `app/auth/` is also a backend contract — covered by the explicit frozen list in master plan §9 / SESSION_LOG. **Do not touch.** |
| `app/order/[orderId]/page.tsx` | page | **keep** | GUEST-ENTRY-LOAD, GUEST-ENTRY-TOKEN-INVALID | Server component; validates UUID + cookie + token, loads order via service client. Delegates to client `guest-panel-opener.tsx`. |
| `app/account/page.tsx` | page | **keep** | SWIP-ACCOUNT-LOAD, SWIP-ACCOUNT-MODAL, SWIP-ACCOUNT-EMAIL, SWIP-ACCOUNT-SIGNOUT, SWIP-ACCOUNT-DELETE, SWIP-ACCOUNT-BECOME-CTA, SWIP-ACCOUNT-SCHOOL-SELECT, SWIP-ACCOUNT-STRIPE-STATUS, SWIP-ACCOUNT-STRIPE-LINK, SWIP-ACCOUNT-STRIPE-DASHBOARD | Server component; parallel fetch of profile, stripe_accounts, schools. Renders modal-style overlay (closes via `router.back()`). The modal is route-backed (not a parallel slot) so deep-linking and Back work. |
| `app/swiper-registration/page.tsx` | page | **keep** | SWIP-REG-LOAD, SWIP-REG-SCHOOL, SWIP-REG-SAVE-SCHOOL, SWIP-REG-STRIPE, SWIP-REG-ERROR | Server component fetches profile + schools; redirects `is_swiper=true` users to `/account`. Two-step form lives in client `swiper-registration-form.tsx`. |
| `app/swiper/layout.tsx` | layout | **keep** | (server-side swiper gate; no public ID) | Server-only redirect for non-swipers. Master plan §10: "do NOT move into a client effect — security regression." Stays exactly as-is. |
| `app/swiper/orders/page.tsx` | page | **keep** | SWIP-QUEUE-LOAD, SWIP-QUEUE-LIST, SWIP-QUEUE-EMPTY, SWIP-QUEUE-DETAIL, SWIP-QUEUE-GALLERY, SWIP-QUEUE-ACCEPT, SWIP-QUEUE-ACCEPT-BANNER | Server-side initial query (school + status=open + swiper_id IS NULL ordered oldest-first); client `pending-orders-list.tsx` hosts modal + accept action. Add colocated `error.tsx`. |
| `app/stripe/onboard/complete/page.tsx` | page | **keep** | SWIP-ONBOARD-COMPLETE-LOAD, SWIP-ONBOARD-COMPLETE-SUCCESS, SWIP-ONBOARD-ALMOST-THERE | Server component reconciles Stripe account + flips `is_swiper=true` server-side. Add colocated `error.tsx` (Stripe SDK lookup failure surfaces here). |
| `app/stripe/onboard/refresh/page.tsx` | page | **keep** | SWIP-ONBOARD-REFRESH | Static server component — links back to `/swiper-registration`. |

**Total: 16 user-facing entries.** Decisions: 13 keep, 1 keep-restructure
(layout), 2 delete (parallel slot), 0 rename/merge/split. The URL surface
is already correct; the redesign reshapes pages, not paths.

## 2. Canonical post-redesign route tree

Adapted from master plan §Phase 2 with the parallel slot removed and the
Session 03 additions annotated. Items marked `(new)` do not exist in the
current tree and are introduced by the indicated session.

```
app/
  layout.tsx                      # GLOBAL-LAYOUT-ROOT — drops `banner` prop in S07
  loading.tsx                     # (new, S03) global skeleton
  error.tsx                       # (new, S03) global error boundary
  not-found.tsx                   # (new, S03)
  page.tsx                        # / (orderer home) — Flow 1
  globals.css                     # OKLCH tokens (S03)
  fonts.ts                        # (new, S03) Bricolage Grotesque + Figtree
  checkout/
    page.tsx                      # Flow 1 (Stripe Embedded)
    error.tsx                     # (new, S04)
    loading.tsx                   # (existing? else new, S04)
    return/
      page.tsx                    # Flow 1 terminal
      error.tsx                   # (new, S04)
  orders/
    page.tsx                      # Flow 2 (history)
  current-orders/
    page.tsx                      # Flow 2 (active list)
    current-orders-list.tsx       # client component
    error.tsx                     # (new, S04)
  auth/
    login/
      page.tsx                    # Flows 5 + 6
      login-form.tsx              # client multi-step form
    callback/route.ts             # FROZEN — see §5
  order/[orderId]/
    page.tsx                      # Flow 4 (guest entry)
    guest-panel-opener.tsx        # client; signInAnonymously + redirect
  account/
    page.tsx                      # account modal (route-backed, not slot)
    account-actions.tsx           # client (signout, delete confirm)
    swiper-section.tsx            # client (school + Stripe sub-actions)
  swiper-registration/
    page.tsx                      # Flow 7
    swiper-registration-form.tsx  # client two-step form
  swiper/
    layout.tsx                    # server-side swiper gate (UNCHANGED)
    orders/
      page.tsx                    # Flow 3 entry
      pending-orders-list.tsx     # client (modal + accept)
      error.tsx                   # (new, S04)
  stripe/onboard/
    complete/
      page.tsx                    # Flow 8
      error.tsx                   # (new, S04)
    refresh/
      page.tsx                    # Flow 8
  api/                            # FROZEN — see §5
```

Removed vs. current tree: `app/@banner/page.tsx` and
`app/@banner/default.tsx` (Session 07 deletion).

## 3. Per-route matrix

For each kept route: feature IDs owned, backend endpoints called, data-fetch
strategy, and the state-branch → testid mapping. Backend endpoints are
sourced from `00-features.md`'s `backend_contract` field; testids from the
`testid` field. State branches not surfaced in the DOM (`null` testid in
the catalog) get a `—` row indicating the branch is purely transient.

### `/` (`app/page.tsx`)

| Field | Value |
|-------|-------|
| Owns | ORD-HOME-LOAD, ORD-HOME-FILE-SELECT, ORD-HOME-THUMBNAIL-STRIP, ORD-HOME-UPLOAD, ORD-HOME-PLACE-ORDER-CTA, ORD-HOME-UPLOAD-ERROR |
| Endpoints called | `POST /api/cart-screenshots/upload-url` |
| Strategy | client component (drag-drop + sessionStorage) |
| Realtime | none |
| Storage | `cart-screenshots` (signed-URL PUT) |

| State branch | testid |
|--------------|--------|
| idle | `home-page` (root container) |
| selected | `home-thumbnail-strip` |
| uploading | `home-upload-status` |
| ready | `home-place-order-button` |
| error | `home-error-message` |

### `/checkout` (`app/checkout/page.tsx`)

| Field | Value |
|-------|-------|
| Owns | ORD-CHECKOUT-LOAD, ORD-CHECKOUT-CART-PREVIEW, ORD-CHECKOUT-FORM-GUEST, ORD-CHECKOUT-FORM-AUTHED, ORD-CHECKOUT-CREATE-SESSION, ORD-CHECKOUT-EMBEDDED, ORD-CHECKOUT-ERROR, ORD-CHECKOUT-BACK |
| Endpoints called | `POST /api/stripe/checkout-session` |
| Strategy | client component (Embedded Stripe iframe) |
| Realtime | none |
| Storage | `cart-screenshots` (read via `supabase.storage.createSignedUrls`) |

| State branch | testid |
|--------------|--------|
| auth_loading | `checkout-page` (root) |
| form_ready (guest) | `checkout-form-guest` |
| form_ready (authed) | `checkout-form-authed` |
| submitting | `checkout-submit-button` |
| checkout_mounted | `checkout-stripe-embedded` |
| error | `checkout-error-message` |
| redirect_no_screenshots | — (server-side `redirect()`) |

### `/checkout/return` (`app/checkout/return/page.tsx`)

| Field | Value |
|-------|-------|
| Owns | ORD-CHECKOUT-RETURN-LOAD, ORD-CHECKOUT-RETURN-GUEST, ORD-CHECKOUT-RETURN-AUTHED, ORD-CHECKOUT-RETURN-INVALID |
| Endpoints called | `GET /api/guest/verify-order?pi_id={pi_id}` (302 target) |
| Strategy | server component (Stripe SDK lookup → `redirect()`) |
| Realtime | none |
| Storage | none |

| State branch | testid |
|--------------|--------|
| resolving | `checkout-return-page` |
| redirect (any branch) | — |

### `/orders` (`app/orders/page.tsx`)

| Field | Value |
|-------|-------|
| Owns | ORD-ORDERS-LOAD, ORD-ORDERS-LIST, ORD-ORDERS-EMPTY |
| Endpoints called | none (direct Supabase query via SSR client) |
| Strategy | server component, parallel fetch (`orderer_id` + `swiper_id`) |
| Realtime | none |
| Storage | none |

| State branch | testid |
|--------------|--------|
| loading | — (handled by `loading.tsx` if added) |
| populated | `orders-list` |
| empty | `orders-empty-state` |

### `/current-orders` (`app/current-orders/page.tsx` + `current-orders-list.tsx`)

| Field | Value |
|-------|-------|
| Owns | ORD-CURRENT-LOAD, ORD-CURRENT-LIST, ORD-CURRENT-EMPTY, ORD-CURRENT-STATUS-BADGE |
| Endpoints called | none directly; embedded ChatView calls `GET /api/messages/[orderId]`, `POST /api/messages` |
| Strategy | server initial fetch; client list with realtime subscription |
| Realtime | `orders:orderer:{userId}` (status updates) |
| Storage | `completion-photos` (read via signed URL inside ChatView) |

| State branch | testid |
|--------------|--------|
| loading | `current-orders-page` |
| populated | `current-orders-list` |
| empty | `current-orders-empty-state` |
| status badge (any of open/in_progress/completed/cancelled) | `current-orders-status-badge` |

### `/auth/login` (`app/auth/login/page.tsx` + `login-form.tsx`)

| Field | Value |
|-------|-------|
| Owns | AUTH-LOGIN-LOAD, AUTH-LOGIN-EMAIL-STEP, AUTH-LOGIN-CHECK-EMAIL, AUTH-LOGIN-PASSWORD-STEP, AUTH-LOGIN-SIGNIN, AUTH-LOGIN-NAME-STEP, AUTH-LOGIN-NAME-CONTINUE, AUTH-LOGIN-SCHOOL-STEP, AUTH-LOGIN-PASSWORD-CONFIRM, AUTH-LOGIN-COMPLETE, AUTH-LOGIN-BACK, AUTH-LOGIN-CALLBACK-ERROR, AUTH-LOGIN-FORM-ERROR |
| Endpoints called | `GET /api/auth/check-email`; server actions `authenticate`, `completeOnboarding` |
| Strategy | server component prefetches schools; client multi-step form |
| Realtime | none |
| Storage | none |

| State branch | testid |
|--------------|--------|
| loading | `login-page` |
| email step | `auth-email-input`, `auth-continue-button` |
| password step | `auth-password-input`, `auth-signin-button` / `auth-signup-button` |
| password confirm (new user) | `auth-password-confirm-input` |
| name step | `auth-fullname-input`, `auth-name-continue-button` |
| school step | `auth-school-input`, `auth-onboarding-complete-button` |
| any step ≥ 2 | `auth-back-button` |
| callback `?error=...` | `auth-callback-error` |
| form error | `auth-form-error` |

### `/order/[orderId]` (`app/order/[orderId]/page.tsx` + `guest-panel-opener.tsx`)

| Field | Value |
|-------|-------|
| Owns | GUEST-ENTRY-LOAD, GUEST-ENTRY-TOKEN-INVALID, GUEST-ENTRY-ANON-SIGNIN, GUEST-ENTRY-BOOTSTRAP-SPINNER |
| Endpoints called | `PATCH /api/guest/orders/[orderId]` (anon-user-id association) |
| Strategy | server validation → client `signInAnonymously` + redirect |
| Realtime | none on this route (chat panel takes over after redirect) |
| Storage | none |

| State branch | testid |
|--------------|--------|
| validating | `guest-entry-page` |
| invalid → 302 | — |
| signing_in / associating / opening_panel / redirecting | `guest-panel-opener`, `guest-bootstrap-spinner` |

### `/account` (`app/account/page.tsx` + `account-actions.tsx` + `swiper-section.tsx`)

| Field | Value |
|-------|-------|
| Owns | SWIP-ACCOUNT-LOAD, SWIP-ACCOUNT-MODAL, SWIP-ACCOUNT-EMAIL, SWIP-ACCOUNT-SIGNOUT, SWIP-ACCOUNT-DELETE, SWIP-ACCOUNT-BECOME-CTA, SWIP-ACCOUNT-SCHOOL-SELECT, SWIP-ACCOUNT-STRIPE-STATUS, SWIP-ACCOUNT-STRIPE-LINK, SWIP-ACCOUNT-STRIPE-DASHBOARD |
| Endpoints called | `PATCH /api/profile`, `POST /api/stripe/connect`, `POST /api/stripe/connect/dashboard` |
| Strategy | server component parallel-fetches profile + stripe_accounts + schools; client sub-components for actions |
| Realtime | none |
| Storage | none |

| State branch | testid |
|--------------|--------|
| loading | `account-page` (root) |
| modal open | `account-modal` |
| email display | `account-email-display` |
| signout | `account-signout-button` |
| delete confirm | `account-delete-button` |
| become-swiper CTA (orderer) | `account-become-swiper-cta` |
| school selector (swiper) | `account-school-selector`, `account-school-save-button` |
| Stripe pending | `account-stripe-status`, `account-stripe-link-button` |
| Stripe connected | `account-stripe-dashboard-button` |

### `/swiper-registration` (`app/swiper-registration/page.tsx` + form)

| Field | Value |
|-------|-------|
| Owns | SWIP-REG-LOAD, SWIP-REG-SCHOOL, SWIP-REG-SAVE-SCHOOL, SWIP-REG-STRIPE, SWIP-REG-ERROR |
| Endpoints called | `PATCH /api/profile`, `POST /api/stripe/connect` |
| Strategy | server fetch (profile + schools); client two-step form |
| Realtime | none |
| Storage | none |

| State branch | testid |
|--------------|--------|
| loading | `swiper-registration-page` |
| school selection | `swiper-reg-school-selector`, `swiper-reg-save-button` |
| Stripe step | `swiper-reg-continue-button` |
| error | `swiper-reg-error-message` |

### `/swiper/orders` (`app/swiper/orders/page.tsx` + `pending-orders-list.tsx`)

| Field | Value |
|-------|-------|
| Owns | SWIP-QUEUE-LOAD, SWIP-QUEUE-LIST, SWIP-QUEUE-EMPTY, SWIP-QUEUE-DETAIL, SWIP-QUEUE-GALLERY, SWIP-QUEUE-ACCEPT, SWIP-QUEUE-ACCEPT-BANNER |
| Endpoints called | `PATCH /api/orders/[id]/accept`; `GET /api/swiper/pending` (badge / refresh) |
| Strategy | server initial query through `app/swiper/layout.tsx` gate; client modal + accept |
| Realtime | none on this page (Session 07 may add `orders:school:{schoolId}` if added) |
| Storage | `cart-screenshots` (signed URL display) |

| State branch | testid |
|--------------|--------|
| loading | `swiper-orders-page` |
| populated | `pending-orders-list` |
| empty | `swiper-orders-empty-state` |
| order detail modal | `swiper-order-detail-modal`, `swiper-screenshot-gallery` |
| accept (idle / claiming / accepted / 409 / 403 / network) | `swiper-accept-button` |
| post-accept | `swiper-accept-success-banner` |

### `/stripe/onboard/complete`

| Field | Value |
|-------|-------|
| Owns | SWIP-ONBOARD-COMPLETE-LOAD, SWIP-ONBOARD-COMPLETE-SUCCESS, SWIP-ONBOARD-ALMOST-THERE |
| Endpoints called | none (Stripe SDK + service-client write, server-only) |
| Strategy | server component reconciles + redirects on success |
| Realtime | none |
| Storage | none |

| State branch | testid |
|--------------|--------|
| syncing | — |
| redirect on success | — |
| almost-there fallback | `onboard-almost-there-page` |

### `/stripe/onboard/refresh`

| Field | Value |
|-------|-------|
| Owns | SWIP-ONBOARD-REFRESH |
| Endpoints called | none |
| Strategy | static server component |
| Realtime | none |
| Storage | none |

| State branch | testid |
|--------------|--------|
| display | `onboard-refresh-page` |

## 4. Error-boundary placements

Per master plan §Phase 2, `error.tsx` is colocated where failure modes are
materially different from the global boundary. Other routes fall through.

| Route | Distinct failure modes warranting `error.tsx` |
|-------|------------------------------------------------|
| `/checkout` | Stripe Embedded mount failure; `POST /api/stripe/checkout-session` non-2xx; sessionStorage parse error |
| `/checkout/return` | Stripe SDK `sessions.retrieve` failure; missing `payment_intent` metadata |
| `/current-orders` | Realtime channel failure; `GET /api/messages/[orderId]` failure inside ChatView |
| `/swiper/orders` | `PATCH /api/orders/[id]/accept` 5xx; signed-URL expiry mid-render |
| `/stripe/onboard/complete` | Stripe SDK `accounts.retrieve` failure; service-client write failure |

Global `app/error.tsx` (Session 03) handles every other route.
`not-found.tsx` is added at `app/not-found.tsx` only — no per-route 404
overrides are needed because the catalog has no dynamic-segment routes
beyond `/order/[orderId]`, and that route already redirects on invalid
UUID rather than 404'ing.

## 5. Frozen API surface — do not touch

Master plan §9 freezes `app/api/**` and `app/auth/callback/route.ts`. They
are listed here so the redesign craft passes have a canonical lookup of
what consumes each endpoint.

### `app/api/**` (20 routes)

| Endpoint | Method | Consumed by feature ID(s) | Notes |
|----------|--------|---------------------------|-------|
| `/api/auth/check-email` | GET | AUTH-LOGIN-CHECK-EMAIL | 300ms-delayed response (timing-attack mitigation). |
| `/api/cart-screenshots/upload-url` | POST | ORD-HOME-UPLOAD | Returns signed URL for `cart-screenshots` bucket. |
| `/api/guest/messages` | POST | GLOBAL-CHAT-INPUT-ACTIVE (guest) | Guest message send. |
| `/api/guest/messages/[orderId]` | GET | GLOBAL-CHAT-VIEW (guest) | Guest message thread fetch. |
| `/api/guest/orders/[orderId]` | PATCH | GUEST-ENTRY-ANON-SIGNIN | Associates `anon_user_id` after `signInAnonymously()`. |
| `/api/guest/verify-order` | GET | ORD-CHECKOUT-RETURN-GUEST | Sets `guest_order_token_{orderId}` cookie + redirects. |
| `/api/messages` | POST | GLOBAL-CHAT-INPUT-ACTIVE (authed) | Authed message send. |
| `/api/messages/[orderId]` | GET | GLOBAL-CHAT-VIEW (authed) | Authed message thread fetch. |
| `/api/messages/[orderId]/upload` | POST | GLOBAL-CHAT-PHOTO-UPLOAD | Completion-photo multipart upload → `completion-photos`. |
| `/api/orders` | GET | (server-only / future use) | No current frontend caller; reserved by backend contract. |
| `/api/orders/[id]/accept` | PATCH | SWIP-QUEUE-ACCEPT | Atomic claim via service client. |
| `/api/orders/[id]/status` | PATCH | GLOBAL-COMPLETION-COMPLETE, GLOBAL-COMPLETION-UNACCEPT | State-machine transitions. |
| `/api/profile` | PATCH | SWIP-ACCOUNT-SCHOOL-SELECT, SWIP-REG-SAVE-SCHOOL | Updates `school_id` (and other profile fields). |
| `/api/stripe/checkout-session` | POST | ORD-CHECKOUT-CREATE-SESSION | Returns `clientSecret` for Embedded Checkout. |
| `/api/stripe/connect` | POST | SWIP-REG-STRIPE, SWIP-ACCOUNT-STRIPE-LINK | Creates Stripe Connect account + onboarding link. |
| `/api/stripe/connect/dashboard` | POST | SWIP-ACCOUNT-STRIPE-DASHBOARD | Creates one-time Express dashboard login URL. |
| `/api/stripe/webhooks` | POST | (Stripe → server, no UI caller) | `payment_intent.succeeded` creates orders; `account.updated` flips `onboarding_complete`. |
| `/api/swiper/pending` | GET | GLOBAL-SWIPER-BADGE (server-render); SWIP-QUEUE-LIST (refresh) | Pending-order count + list at swiper's school. |

> The 20-route count includes the `route.ts` files under `app/api/` listed
> here (18 explicit endpoints + 2 server-only endpoints under
> `/api/orders` aggregation). Cross-checked against the `find` output
> in the planning step.

### `app/auth/callback/route.ts`

OAuth landing for Supabase auth flow. Server-only. No frontend caller; the
route is the redirect target Supabase posts to. **Do not touch** —
master plan §9 freezes it the same way it freezes `app/api/**`.

## 6. ADR record

Decisions made during this session that are not pre-locked by the master
plan. Each is a future-self justification.

1. **Parallel-route slot `app/@banner/` is deleted in Session 07, not now.**
   The slot is currently active (`app/layout.tsx` consumes the `banner`
   prop). Deletion requires deleting both files plus updating the layout's
   props signature plus rendering `<Banner>` directly — that's a code edit
   outside the docs-only scope of Session 02. Document the decision; ship
   the deletion with the rest of the shell rewrite.

2. **`/account` stays a route (not a parallel `@modal` slot) even though it
   renders modal-style.** Trade-off: a parallel slot would persist the
   underlying page underneath. But: (a) the modal reads dynamic data
   (profile, stripe state, schools) so soft-navigation back-and-forth
   already needs server fetches; (b) deep-linking `/account` and the back
   button work naturally; (c) every flow that lands on `/account` can be
   reentered from any page via the header link. Master plan §Decisions
   locked already prefers no parallel routes; this confirms it for the
   account surface.

3. **Onboarding-resume is not a separate route.** When an authenticated
   user without a `profiles` row signs in, `app/auth/login/login-form.tsx`
   detects the missing profile and routes the form's internal state
   machine into `name → school → complete`. No extra URL is created. This
   keeps the redirect graph simple and avoids a `/auth/onboarding` route
   that would have to be guarded against authed-with-profile users.

4. **Distinct `error.tsx` only at the five routes listed in §4.** Adding
   one everywhere is over-engineering — the global `app/error.tsx` is
   sufficient for routes whose failure modes are generic (network /
   permission). The five exceptions all have non-generic failure modes
   (Stripe SDK calls, realtime channels, atomic claims).

5. **`app/swiper/layout.tsx` server-side gate stays server-side.** Master
   plan §10 calls this out as a security invariant; this ADR records the
   decision so a future Session 04+ author doesn't move it into a client
   effect for "loading-state ergonomics."

6. **No new dynamic segments, no merges, no splits.** The current URL
   surface is already correct. The redesign is a reskin (Phase 4), a
   token swap (Phase 3), and a shell rewrite (Session 07) — nothing
   architectural at the URL level beyond purging the parallel slot.
