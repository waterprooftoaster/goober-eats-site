# Goober Eats Feature Catalog (Phase 0)

> Source of truth for the redesign epic. Every later phase references these IDs.
> Produced in Session 01; locked at session close by SHA-256 hash recorded in `SESSION_LOG.md`.
> Any change requires a `FEATURES_CHANGELOG.md` entry.

## Legend

- ID format: `{ROLE}-{AREA}-{VERB}` — stable across the epic.
- Roles:
  - **ORD** — orderer/guest flows
  - **SWIP** — swiper flows
  - **GUEST** — guest-specific (anonymous session, cookie)
  - **AUTH** — authentication UI
  - **GLOBAL** — shell, providers, shared chrome
- One feature per atomic user-visible behavior. Every state branch, guard, transient screen counts.
- `owner_route` is a single route path, or `layout` for shell-level features.
- `backend_contract: null` means purely client-side behavior; otherwise it names the endpoint + method consumed. Endpoints are FROZEN (see plan §9).
- `realtime: null` means no Supabase Realtime subscription; otherwise names the channel pattern.
- `storage: null` means no Supabase Storage interaction; otherwise names the bucket.
- `testid` is the `data-testid` the redesigned code must set on its root / primary element so E2E selectors survive.

---

## ORD — Orderer / Guest

### /

```yaml
- id: ORD-HOME-LOAD
  title: Home page render
  owner_route: /
  current_file: app/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, guest_cookie]
  state_branches: [idle, selected, uploading, error]
  testid: home-page
  notes: Landing page with cart-screenshot upload zone.

- id: ORD-HOME-FILE-SELECT
  title: Select cart screenshot files
  owner_route: /
  current_file: app/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, guest_cookie]
  state_branches: [idle, selected]
  testid: home-file-input
  notes: Drag-drop or tap to open file picker. Accepts png, jpeg, webp, heic, heif. Multi-file.

- id: ORD-HOME-THUMBNAIL-STRIP
  title: Selected screenshot thumbnail preview strip
  owner_route: /
  current_file: app/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, guest_cookie]
  state_branches: [selected]
  testid: home-thumbnail-strip
  notes: Each thumbnail has remove (x) affordance; + button to add more files.

- id: ORD-HOME-UPLOAD
  title: Upload screenshots via signed URL
  owner_route: /
  current_file: app/page.tsx
  backend_contract: POST /api/cart-screenshots/upload-url (returns { session_id, path, signed_url, token })
  realtime: null
  storage: cart-screenshots
  auth_branches: [anon, authed_orderer, guest_cookie]
  state_branches: [uploading, success]
  testid: home-upload-status
  notes: Client PUTs blob to Storage via signed URL; echoes session_id across multiple files in same upload batch. Paths stored in sessionStorage.pending_screenshots.

- id: ORD-HOME-PLACE-ORDER-CTA
  title: Continue-to-checkout primary CTA
  owner_route: /
  current_file: app/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, guest_cookie]
  state_branches: [disabled, ready, submitting]
  testid: home-place-order-button
  notes: Enabled once ≥1 screenshot is uploaded and no upload is in progress; navigates to /checkout.

- id: ORD-HOME-UPLOAD-ERROR
  title: Upload error surface
  owner_route: /
  current_file: app/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, guest_cookie]
  state_branches: [error]
  testid: home-error-message
  notes: Covers bad MIME, network failure, signed-URL expiry. User can retry without re-selecting file.
```

### /checkout

```yaml
- id: ORD-CHECKOUT-LOAD
  title: Checkout page entry
  owner_route: /checkout
  current_file: app/checkout/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, guest_cookie]
  state_branches: [auth_loading, form_ready, submitting, checkout_mounted, error, redirect_no_screenshots]
  testid: checkout-page
  notes: Reads sessionStorage.pending_screenshots on mount; redirects to / if empty. Resolves auth state via Supabase client.

- id: ORD-CHECKOUT-CART-PREVIEW
  title: Cart screenshot preview column
  owner_route: /checkout
  current_file: app/checkout/page.tsx
  backend_contract: null
  realtime: null
  storage: cart-screenshots
  auth_branches: [anon, authed_orderer, guest_cookie]
  state_branches: [loading_urls, displayed]
  testid: checkout-cart-preview
  notes: Fetches signed display URLs via supabase.storage.createSignedUrls(paths, 3600); renders stacked images.

- id: ORD-CHECKOUT-FORM-GUEST
  title: Guest checkout form (name + restaurant + total)
  owner_route: /checkout
  current_file: app/checkout/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, guest_cookie]
  state_branches: [form_ready, submitting]
  testid: checkout-form-guest
  notes: Guest branch adds guest_name field (max 100 chars); email derived from guest flow.

- id: ORD-CHECKOUT-FORM-AUTHED
  title: Authenticated checkout form (restaurant + total)
  owner_route: /checkout
  current_file: app/checkout/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer]
  state_branches: [form_ready, submitting]
  testid: checkout-form-authed
  notes: Restaurant (max 80 chars) + total ($0.50-$500.00, step 0.01). School_id derived from profile.

- id: ORD-CHECKOUT-CREATE-SESSION
  title: Create Stripe Checkout session
  owner_route: /checkout
  current_file: app/checkout/page.tsx
  backend_contract: POST /api/stripe/checkout-session (returns { clientSecret })
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, guest_cookie]
  state_branches: [submitting, success, error]
  testid: checkout-submit-button
  notes: On success, clears sessionStorage.pending_screenshots and mounts EmbeddedCheckout. Metadata keys are frozen (see plan §9).

- id: ORD-CHECKOUT-EMBEDDED
  title: Stripe Embedded Checkout mount
  owner_route: /checkout
  current_file: app/checkout/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, guest_cookie]
  state_branches: [mounted]
  testid: checkout-stripe-embedded
  notes: Uses @stripe/react-stripe-js EmbeddedCheckoutProvider + EmbeddedCheckout with client secret from ORD-CHECKOUT-CREATE-SESSION.

- id: ORD-CHECKOUT-ERROR
  title: Checkout error surface
  owner_route: /checkout
  current_file: app/checkout/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, guest_cookie]
  state_branches: [error]
  testid: checkout-error-message
  notes: Shows API error or network failure; form remains editable for retry.

- id: ORD-CHECKOUT-BACK
  title: Back-to-home affordance
  owner_route: /checkout
  current_file: components/back-button.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, guest_cookie]
  state_branches: [enabled]
  testid: checkout-back-button
  notes: router.back() behavior; does not clear sessionStorage.
```

### /checkout/return

```yaml
- id: ORD-CHECKOUT-RETURN-LOAD
  title: Stripe return session resolution
  owner_route: /checkout/return
  current_file: app/checkout/return/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, guest_cookie]
  state_branches: [resolving]
  testid: checkout-return-page
  notes: Server component; retrieves Stripe session via Stripe SDK to read payment_intent id + metadata.

- id: ORD-CHECKOUT-RETURN-GUEST
  title: Guest redirect to verify-order
  owner_route: /checkout/return
  current_file: app/checkout/return/page.tsx
  backend_contract: GET /api/guest/verify-order?pi_id={pi_id}
  realtime: null
  storage: null
  auth_branches: [guest_cookie]
  state_branches: [redirecting]
  testid: null
  notes: When session.metadata.is_guest === 'true', 302s to verify-order endpoint (which sets the guest_order_token cookie).

- id: ORD-CHECKOUT-RETURN-AUTHED
  title: Authenticated redirect to /current-orders
  owner_route: /checkout/return
  current_file: app/checkout/return/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer]
  state_branches: [redirecting]
  testid: null
  notes: Redirects authed users to /current-orders.

- id: ORD-CHECKOUT-RETURN-INVALID
  title: Missing or invalid session handling
  owner_route: /checkout/return
  current_file: app/checkout/return/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, guest_cookie]
  state_branches: [redirect_home]
  testid: null
  notes: Redirects to / if session_id missing, lookup fails, or payment_intent absent.
```

### /orders

```yaml
- id: ORD-ORDERS-LOAD
  title: Orders history page entry
  owner_route: /orders
  current_file: app/orders/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper, authed_swiper_pre_stripe]
  state_branches: [loading]
  testid: orders-page
  notes: Server component; redirects to /auth/login if anon. Queries orders by orderer_id and swiper_id in parallel.

- id: ORD-ORDERS-LIST
  title: Merged orders list (newest first)
  owner_route: /orders
  current_file: app/orders/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper, authed_swiper_pre_stripe]
  state_branches: [populated]
  testid: orders-list
  notes: Merges placed and fulfilled orders; each card shows restaurant, date, total, status, and role badge (Fulfilled vs Placed).

- id: ORD-ORDERS-EMPTY
  title: Empty orders state
  owner_route: /orders
  current_file: app/orders/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper, authed_swiper_pre_stripe]
  state_branches: [empty]
  testid: orders-empty-state
  notes: Shown when user has placed and fulfilled zero orders.
```

### /current-orders

```yaml
- id: ORD-CURRENT-LOAD
  title: Current orders page entry
  owner_route: /current-orders
  current_file: app/current-orders/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper]
  state_branches: [loading]
  testid: current-orders-page
  notes: Server component; fetches orders with status in [open, in_progress] where user is orderer or swiper. Redirects anon to /auth/login.

- id: ORD-CURRENT-LIST
  title: Active orders list with embedded chat
  owner_route: /current-orders
  current_file: app/current-orders/current-orders-list.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper]
  state_branches: [populated]
  testid: current-orders-list
  notes: Each card hosts status badge + embedded ChatView (GLOBAL-CHAT-*).

- id: ORD-CURRENT-EMPTY
  title: No active orders empty state
  owner_route: /current-orders
  current_file: app/current-orders/current-orders-list.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper]
  state_branches: [empty]
  testid: current-orders-empty-state
  notes: Shown when user has no open or in_progress orders.

- id: ORD-CURRENT-STATUS-BADGE
  title: Per-order status badge (realtime-driven)
  owner_route: /current-orders
  current_file: app/current-orders/current-orders-list.tsx
  backend_contract: null
  realtime: orders:orderer:{userId}
  storage: null
  auth_branches: [authed_orderer, authed_swiper]
  state_branches: [open, in_progress, completed, cancelled]
  testid: current-orders-status-badge
  notes: Reflects server state; transitions propagate via GLOBAL-CHATPANEL-REALTIME-STATUS.
```

---

## SWIP — Swiper

### /account

```yaml
- id: SWIP-ACCOUNT-LOAD
  title: Account page entry
  owner_route: /account
  current_file: app/account/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper_pre_stripe, authed_swiper]
  state_branches: [loading]
  testid: account-page
  notes: Server component; fetches profile, stripe_accounts, schools in parallel. Redirects anon to /auth/login.

- id: SWIP-ACCOUNT-MODAL
  title: Account modal overlay
  owner_route: /account
  current_file: components/account-panel.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper_pre_stripe, authed_swiper]
  state_branches: [open]
  testid: account-modal
  notes: Fixed overlay with backdrop; click outside or close X triggers router.back().

- id: SWIP-ACCOUNT-EMAIL
  title: Email display
  owner_route: /account
  current_file: components/account-panel.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper_pre_stripe, authed_swiper]
  state_branches: [display]
  testid: account-email-display
  notes: Shows user.email.

- id: SWIP-ACCOUNT-SIGNOUT
  title: Sign-out action
  owner_route: /account
  current_file: app/account/account-actions.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper_pre_stripe, authed_swiper]
  state_branches: [idle, signing_out]
  testid: account-signout-button
  notes: Calls Supabase auth.signOut via server action; redirects to /.

- id: SWIP-ACCOUNT-DELETE
  title: Delete-account two-step confirmation
  owner_route: /account
  current_file: app/account/account-actions.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper_pre_stripe, authed_swiper]
  state_branches: [idle, confirming, deleting, error]
  testid: account-delete-button
  notes: Confirmation dialog with explicit Yes/Cancel.

- id: SWIP-ACCOUNT-BECOME-CTA
  title: Become-a-Swiper CTA for non-swipers
  owner_route: /account
  current_file: app/account/swiper-section.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer]
  state_branches: [display]
  testid: account-become-swiper-cta
  notes: Links to /swiper-registration; hidden when profile.is_swiper === true.

- id: SWIP-ACCOUNT-SCHOOL-SELECT
  title: School selector (swiper only)
  owner_route: /account
  current_file: app/account/swiper-section.tsx
  backend_contract: PATCH /api/profile (updates school_id)
  realtime: null
  storage: null
  auth_branches: [authed_swiper_pre_stripe, authed_swiper]
  state_branches: [display, editing, saving, saved, error]
  testid: account-school-selector
  notes: Combobox list from schools table; save persists and toasts confirmation.

- id: SWIP-ACCOUNT-STRIPE-STATUS
  title: Stripe Connect status badge
  owner_route: /account
  current_file: app/account/swiper-section.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_swiper_pre_stripe, authed_swiper]
  state_branches: [pending, connected]
  testid: account-stripe-status
  notes: Pending vs Connected; reflects stripe_accounts.onboarding_complete.

- id: SWIP-ACCOUNT-STRIPE-LINK
  title: Stripe Connect link / relink action
  owner_route: /account
  current_file: app/account/swiper-section.tsx
  backend_contract: POST /api/stripe/connect (returns { url })
  realtime: null
  storage: null
  auth_branches: [authed_swiper_pre_stripe, authed_swiper]
  state_branches: [idle, linking]
  testid: account-stripe-link-button
  notes: Redirects to Stripe Connect onboarding URL. Visible as Link (pre-onboard) or Relink (post-onboard).

- id: SWIP-ACCOUNT-STRIPE-DASHBOARD
  title: Stripe Express dashboard link
  owner_route: /account
  current_file: app/account/swiper-section.tsx
  backend_contract: POST /api/stripe/connect/dashboard (returns { url })
  realtime: null
  storage: null
  auth_branches: [authed_swiper]
  state_branches: [idle, loading_url]
  testid: account-stripe-dashboard-button
  notes: Visible only when onboarding_complete=true. Creates one-time login link.
```

### /swiper-registration

```yaml
- id: SWIP-REG-LOAD
  title: Swiper registration page entry
  owner_route: /swiper-registration
  current_file: app/swiper-registration/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer]
  state_branches: [loading]
  testid: swiper-registration-page
  notes: Server component; redirects anon to /auth/login. Redirects is_swiper=true to /account. Fetches profile + schools.

- id: SWIP-REG-SCHOOL
  title: School selection (new swiper)
  owner_route: /swiper-registration
  current_file: app/swiper-registration/swiper-registration-form.tsx
  backend_contract: PATCH /api/profile (updates school_id)
  realtime: null
  storage: null
  auth_branches: [authed_orderer]
  state_branches: [unconfirmed, saving, confirmed, error]
  testid: swiper-reg-school-selector
  notes: Combobox; Save persists and unlocks the Stripe step.

- id: SWIP-REG-SAVE-SCHOOL
  title: Save-school button (swiper registration)
  owner_route: /swiper-registration
  current_file: app/swiper-registration/swiper-registration-form.tsx
  backend_contract: PATCH /api/profile (updates school_id)
  realtime: null
  storage: null
  auth_branches: [authed_orderer]
  state_branches: [idle, saving, saved]
  testid: swiper-reg-save-button
  notes: Persists the selected school_id and unlocks the Stripe continue step. Added to catalog in Session 01 (was present in markup but not catalogued).

- id: SWIP-REG-STRIPE
  title: Continue to Stripe Connect onboarding
  owner_route: /swiper-registration
  current_file: app/swiper-registration/swiper-registration-form.tsx
  backend_contract: POST /api/stripe/connect (returns { url })
  realtime: null
  storage: null
  auth_branches: [authed_orderer]
  state_branches: [disabled, ready, connecting, error]
  testid: swiper-reg-continue-button
  notes: Disabled until school confirmed. Redirects to Stripe hosted onboarding.

- id: SWIP-REG-ERROR
  title: Registration error surface
  owner_route: /swiper-registration
  current_file: app/swiper-registration/swiper-registration-form.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer]
  state_branches: [error]
  testid: swiper-reg-error-message
  notes: Shows failure of school save or Stripe link creation.
```

### /swiper/orders

```yaml
- id: SWIP-QUEUE-LOAD
  title: Swiper pending-orders queue page entry
  owner_route: /swiper/orders
  current_file: app/swiper/orders/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_swiper]
  state_branches: [loading]
  testid: swiper-orders-page
  notes: Server component under app/swiper/layout.tsx gate. Filters orders by school_id + status=open + swiper_id IS NULL, ordered oldest-first.

- id: SWIP-QUEUE-LIST
  title: Pending orders list
  owner_route: /swiper/orders
  current_file: app/swiper/orders/pending-orders-list.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_swiper]
  state_branches: [populated]
  testid: pending-orders-list
  notes: Each OrderCard shows restaurant, total, age, thumbnail. Click opens SWIP-QUEUE-DETAIL.

- id: SWIP-QUEUE-EMPTY
  title: No pending orders empty state
  owner_route: /swiper/orders
  current_file: app/swiper/orders/pending-orders-list.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_swiper]
  state_branches: [empty]
  testid: swiper-orders-empty-state
  notes: Shown when no open orders exist at the swiper's school.

- id: SWIP-QUEUE-DETAIL
  title: Order detail modal
  owner_route: /swiper/orders
  current_file: app/swiper/orders/pending-orders-list.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_swiper]
  state_branches: [open, closing]
  testid: swiper-order-detail-modal
  notes: Hosts screenshot gallery (SWIP-QUEUE-GALLERY), total, restaurant, and Accept CTA.

- id: SWIP-QUEUE-GALLERY
  title: Screenshot gallery + lightbox
  owner_route: /swiper/orders
  current_file: components/order/screenshot-gallery.tsx
  backend_contract: null
  realtime: null
  storage: cart-screenshots
  auth_branches: [authed_swiper]
  state_branches: [thumbnails, lightbox]
  testid: swiper-screenshot-gallery
  notes: Horizontal thumbnail strip. Click opens lightbox with prev/next + Escape keyboard nav.

- id: SWIP-QUEUE-ACCEPT
  title: Accept order action
  owner_route: /swiper/orders
  current_file: app/swiper/orders/pending-orders-list.tsx
  backend_contract: PATCH /api/orders/[id]/accept
  realtime: null
  storage: null
  auth_branches: [authed_swiper]
  state_branches: [idle, claiming, accepted, conflict_409, forbidden_403, network_error]
  testid: swiper-accept-button
  notes: No optimistic transition. Shows "Claiming…" disabled state until server responds. On 409 removes card and toasts. On 403 toasts "Complete Stripe onboarding first."

- id: SWIP-QUEUE-ACCEPT-BANNER
  title: Post-accept success banner
  owner_route: /swiper/orders
  current_file: app/swiper/orders/pending-orders-list.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_swiper]
  state_branches: [display]
  testid: swiper-accept-success-banner
  notes: "Order accepted! Head to {restaurant}" — auto-dismisses after 5s. Chat panel for accepted order opens via ChatPanel provider.
```

### /stripe/onboard/complete

```yaml
- id: SWIP-ONBOARD-COMPLETE-LOAD
  title: Stripe Connect return resolver
  owner_route: /stripe/onboard/complete
  current_file: app/stripe/onboard/complete/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_swiper_pre_stripe]
  state_branches: [syncing]
  testid: onboard-complete-page
  notes: Server component. Retrieves Stripe account via SDK to read details_submitted + charges_enabled; updates stripe_accounts.onboarding_complete via service client (read-only from frontend perspective; this page does use service client server-side — not a frontend concern but flagged for awareness).

- id: SWIP-ONBOARD-COMPLETE-SUCCESS
  title: Auto-activate swiper and redirect home
  owner_route: /stripe/onboard/complete
  current_file: app/stripe/onboard/complete/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_swiper_pre_stripe]
  state_branches: [redirecting]
  testid: null
  notes: If onboarding_complete && school_id set, flips is_swiper=true and 302s to /?notice=swiper_activated.

- id: SWIP-ONBOARD-ALMOST-THERE
  title: Onboarding incomplete fallback
  owner_route: /stripe/onboard/complete
  current_file: app/stripe/onboard/complete/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_swiper_pre_stripe]
  state_branches: [display]
  testid: onboard-almost-there-page
  notes: Renders when onboarding incomplete or school not set; links back to /swiper-registration.
```

### /stripe/onboard/refresh

```yaml
- id: SWIP-ONBOARD-REFRESH
  title: Stripe onboarding session-expired page
  owner_route: /stripe/onboard/refresh
  current_file: app/stripe/onboard/refresh/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_swiper_pre_stripe]
  state_branches: [display]
  testid: onboard-refresh-page
  notes: Static page. Links back to /swiper-registration to restart onboarding.
```

---

## GUEST — Guest-specific

### /order/[orderId]

```yaml
- id: GUEST-ENTRY-LOAD
  title: Guest order bootstrap page entry
  owner_route: /order/[orderId]
  current_file: app/order/[orderId]/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [guest_cookie]
  state_branches: [validating]
  testid: guest-entry-page
  notes: Server component. Validates orderId UUID, reads guest_order_token_{orderId} cookie, loads order via service client, confirms orderer_id IS NULL and guest_access_token matches. Redirects authed users to /.

- id: GUEST-ENTRY-TOKEN-INVALID
  title: Invalid/missing token → redirect
  owner_route: /order/[orderId]
  current_file: app/order/[orderId]/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, guest_cookie]
  state_branches: [redirect_home]
  testid: null
  notes: Covers missing cookie, mismatched token, auth user accessing guest URL, or malformed UUID.

- id: GUEST-ENTRY-ANON-SIGNIN
  title: Anonymous sign-in + anon_user_id association
  owner_route: /order/[orderId]
  current_file: app/order/[orderId]/guest-panel-opener.tsx
  backend_contract: PATCH /api/guest/orders/[orderId] (body { anon_user_id })
  realtime: null
  storage: null
  auth_branches: [guest_cookie]
  state_branches: [signing_in, associating, opening_panel, redirecting]
  testid: guest-panel-opener
  notes: Client component. supabase.auth.signInAnonymously() → PATCH anon_user_id → open chat panel → router.replace('/').

- id: GUEST-ENTRY-BOOTSTRAP-SPINNER
  title: Bootstrap loading spinner
  owner_route: /order/[orderId]
  current_file: app/order/[orderId]/guest-panel-opener.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [guest_cookie]
  state_branches: [loading]
  testid: guest-bootstrap-spinner
  notes: Visible until redirect fires (~1s).
```

---

## AUTH — Authentication UI

### /auth/login

```yaml
- id: AUTH-LOGIN-LOAD
  title: Login page entry
  owner_route: /auth/login
  current_file: app/auth/login/page.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, authed_swiper_pre_stripe, authed_swiper]
  state_branches: [loading, redirect_authed]
  testid: login-page
  notes: Server component. Prefetches schools; redirects to / if user already has profile. Query param `?error=...` shows callback-error banner.

- id: AUTH-LOGIN-EMAIL-STEP
  title: Email entry step
  owner_route: /auth/login
  current_file: app/auth/login/login-form.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon]
  state_branches: [idle, validating]
  testid: auth-email-input
  notes: First step; validates email format client-side.

- id: AUTH-LOGIN-CHECK-EMAIL
  title: Check-email existence API call
  owner_route: /auth/login
  current_file: app/auth/login/login-form.tsx
  backend_contract: GET /api/auth/check-email?email={email} (returns { exists })
  realtime: null
  storage: null
  auth_branches: [anon]
  state_branches: [checking, exists, not_exists, error]
  testid: auth-continue-button
  notes: 300ms-delayed server response (timing-attack mitigation). Branches to sign-in vs sign-up path.

- id: AUTH-LOGIN-PASSWORD-STEP
  title: Password entry step
  owner_route: /auth/login
  current_file: app/auth/login/login-form.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon]
  state_branches: [existing_user, new_user]
  testid: auth-password-input
  notes: Existing-user path shows one password input; new-user path shows password + confirm password.

- id: AUTH-LOGIN-SIGNIN
  title: Sign-in submission (existing user)
  owner_route: /auth/login
  current_file: app/auth/login/login-form.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon]
  state_branches: [submitting, success, error]
  testid: auth-signin-button
  notes: Calls authenticate server action. On success redirects to / or continues to onboarding if profile missing.

- id: AUTH-LOGIN-NAME-STEP
  title: Full-name entry (new user onboarding)
  owner_route: /auth/login
  current_file: app/auth/login/login-form.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon]
  state_branches: [idle]
  testid: auth-fullname-input
  notes: Max 100 chars. Present when user is new or resuming onboarding.

- id: AUTH-LOGIN-NAME-CONTINUE
  title: Advance from name step to school step
  owner_route: /auth/login
  current_file: app/auth/login/login-form.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon]
  state_branches: [enabled, disabled]
  testid: auth-name-continue-button
  notes: Disabled until full name is non-empty. Pure client-side step transition, no server call.

- id: AUTH-LOGIN-SCHOOL-STEP
  title: School selection (new user onboarding)
  owner_route: /auth/login
  current_file: app/auth/login/login-form.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon]
  state_branches: [idle]
  testid: auth-school-input
  notes: Searchable combobox backed by schools prefetched server-side.

- id: AUTH-LOGIN-PASSWORD-CONFIRM
  title: Confirm-password input (new-user path)
  owner_route: /auth/login
  current_file: app/auth/login/login-form.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon]
  state_branches: [new_user]
  testid: auth-password-confirm-input
  notes: New-user path only; rendered below auth-password-input on the password step when emailExists === false.

- id: AUTH-LOGIN-COMPLETE
  title: Complete onboarding submission
  owner_route: /auth/login
  current_file: app/auth/login/login-form.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon]
  state_branches: [submitting, success, error]
  testid: auth-onboarding-complete-button
  notes: Final "Get Started" button on the school step. Calls completeOnboarding server action; creates profile row and redirects to /. Renamed from auth-signup-button in Session 01 to avoid collision with the password-step submit for new users, which already carries auth-signup-button.

- id: AUTH-LOGIN-BACK
  title: Step-back navigation
  owner_route: /auth/login
  current_file: app/auth/login/login-form.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon]
  state_branches: [enabled]
  testid: auth-back-button
  notes: Available on password/name/school steps; not available on email step.

- id: AUTH-LOGIN-CALLBACK-ERROR
  title: OAuth callback error banner
  owner_route: /auth/login
  current_file: app/auth/login/login-form.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon]
  state_branches: [display]
  testid: auth-callback-error
  notes: Visible when `?error=...` query param is set (allowlist only; unknown values hidden).

- id: AUTH-LOGIN-FORM-ERROR
  title: Form submission error banner
  owner_route: /auth/login
  current_file: app/auth/login/login-form.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon]
  state_branches: [error]
  testid: auth-form-error
  notes: Shows authenticate or completeOnboarding error; never leaks server detail.
```

---

## GLOBAL — Shell and shared

### Shell (app/layout.tsx)

```yaml
- id: GLOBAL-LAYOUT-ROOT
  title: Root layout shell
  owner_route: layout
  current_file: app/layout.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, authed_swiper_pre_stripe, authed_swiper, guest_cookie]
  state_branches: [display]
  testid: root-layout
  notes: Wraps html/body, fonts, ChatPanelProvider, Header, Banner, SwiperOrdersButton, ChatPanel.

- id: GLOBAL-FONTS
  title: Font loading via next/font
  owner_route: layout
  current_file: app/layout.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, authed_swiper_pre_stripe, authed_swiper, guest_cookie]
  state_branches: [loaded]
  testid: null
  notes: Current fonts are Manrope + Hanken Grotesk; Session 03 swaps to Bricolage Grotesque + Figtree per .impeccable.md.

- id: GLOBAL-SESSION-REFRESH
  title: Supabase session refresh middleware
  owner_route: layout
  current_file: lib/supabase/middleware.ts
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper_pre_stripe, authed_swiper, guest_cookie]
  state_branches: [transparent]
  testid: null
  notes: FROZEN file. Runs on every request to refresh cookies before expiry.
```

### Header

```yaml
- id: GLOBAL-HEADER
  title: Header navigation bar
  owner_route: layout
  current_file: components/header.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, authed_swiper_pre_stripe, authed_swiper, guest_cookie]
  state_branches: [display]
  testid: header
  notes: Server-rendered. Branches on authenticated vs anon user.

- id: GLOBAL-HEADER-HOME
  title: Home link
  owner_route: layout
  current_file: components/header.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, authed_swiper_pre_stripe, authed_swiper, guest_cookie]
  state_branches: [display]
  testid: header-home-link
  notes: Logo link to /.

- id: GLOBAL-HEADER-ORDERS
  title: Orders history link (authed)
  owner_route: layout
  current_file: components/header.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper_pre_stripe, authed_swiper]
  state_branches: [display]
  testid: header-orders-link
  notes: Icon link to /orders.

- id: GLOBAL-HEADER-CURRENT
  title: Current orders link (authed)
  owner_route: layout
  current_file: components/header.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper_pre_stripe, authed_swiper]
  state_branches: [display]
  testid: header-current-orders-link
  notes: Icon link to /current-orders.

- id: GLOBAL-HEADER-ACCOUNT
  title: Account link (authed)
  owner_route: layout
  current_file: components/header.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper_pre_stripe, authed_swiper]
  state_branches: [display]
  testid: header-account-link
  notes: Icon link to /account.

- id: GLOBAL-HEADER-AUTH
  title: Sign-in / Sign-up links (anon)
  owner_route: layout
  current_file: components/header.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, guest_cookie]
  state_branches: [display]
  testid: header-auth-buttons
  notes: Both link to /auth/login.
```

### Banner

```yaml
- id: GLOBAL-BANNER-BECOME
  title: Become-a-Swiper promotional banner
  owner_route: layout
  current_file: components/banner.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, guest_cookie]
  state_branches: [display]
  testid: become-swiper-banner
  notes: Home page only, non-swipers only. Lime-green CTA to /swiper-registration (authed) or /auth/login (anon).

- id: GLOBAL-BANNER-HIDDEN
  title: Banner conditional hidden
  owner_route: layout
  current_file: components/banner.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_swiper_pre_stripe, authed_swiper]
  state_branches: [hidden]
  testid: null
  notes: Returns null when isSwiper || pathname !== '/'.
```

### SwiperOrdersButton

```yaml
- id: GLOBAL-SWIPER-BUTTON
  title: Floating swiper-orders button
  owner_route: layout
  current_file: components/swiper-orders-button.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_swiper, authed_swiper_pre_stripe]
  state_branches: [display]
  testid: swiper-orders-button
  notes: Fixed bottom-left; links to /swiper/orders; hidden when profile.is_swiper=false.

- id: GLOBAL-SWIPER-BADGE
  title: Pending-order badge count
  owner_route: layout
  current_file: components/swiper-orders-button.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_swiper, authed_swiper_pre_stripe]
  state_branches: [zero, n_count]
  testid: swiper-orders-badge
  notes: Counted server-side in layout (orders.status='open' AND school_id=profile.school_id). Currently static at render time.
```

### ChatPanel

```yaml
- id: GLOBAL-CHATPANEL-PROVIDER
  title: ChatPanel context provider
  owner_route: layout
  current_file: components/chat-panel/chat-panel-provider.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper_pre_stripe, authed_swiper, guest_cookie]
  state_branches: [initialized]
  testid: null
  notes: Hosts open-panel stack state, openPanel/closePanel/toggleMinimize/updateOrderStatus actions.

- id: GLOBAL-CHATPANEL-AUTO-OPEN
  title: Auto-open panels for user's active orders
  owner_route: layout
  current_file: components/chat-panel/chat-panel-provider.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper, guest_cookie]
  state_branches: [loading, populated]
  testid: null
  notes: On mount, queries orders (orderer_id OR swiper_id OR anon_user_id match; status in open/in_progress/completed) and opens panel per order.

- id: GLOBAL-CHATPANEL-REALTIME-STATUS
  title: Realtime order-status UPDATE subscription
  owner_route: layout
  current_file: components/chat-panel/chat-panel-provider.tsx
  backend_contract: null
  realtime: orders:orderer:{userId}
  storage: null
  auth_branches: [authed_orderer, authed_swiper, guest_cookie]
  state_branches: [subscribed, reconnecting]
  testid: null
  notes: Subscribes on postgres_changes UPDATE filtered by orderer_id OR anon_user_id. Updates status in open panels; auto-closes on cancelled.

- id: GLOBAL-CHATPANEL-STACK
  title: Chat panel stack render
  owner_route: layout
  current_file: components/chat-panel/chat-panel.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper, guest_cookie]
  state_branches: [display]
  testid: chat-panel-stack
  notes: Fixed bottom-right, newest on top. Mobile shows only topmost; desktop stacks visible.

- id: GLOBAL-CHATPANEL-HEADER
  title: Per-panel header
  owner_route: layout
  current_file: components/chat-panel/chat-panel.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper, guest_cookie]
  state_branches: [display, minimized]
  testid: chat-panel-header
  notes: Shows "Order #{shortId}" (first 8 chars of UUID) plus minimize/close controls.
```

### Chat view (shared across ChatPanel and /current-orders)

```yaml
- id: GLOBAL-CHAT-VIEW
  title: Chat view container
  owner_route: layout
  current_file: components/chat/chat-view.tsx
  backend_contract: GET /api/messages/[orderId] | GET /api/guest/messages/[orderId]
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper, guest_cookie]
  state_branches: [loading, active, completed, closed]
  testid: chat-view
  notes: Hosts thread + input + completion UI. Branches on orderStatus and role (orderer vs swiper).

- id: GLOBAL-CHAT-THREAD
  title: Message thread
  owner_route: layout
  current_file: components/chat/chat-thread.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper, guest_cookie]
  state_branches: [populated]
  testid: chat-thread
  notes: Pseudo-messages (status) pinned at top; real messages below; auto-scroll to bottom on new message.

- id: GLOBAL-CHAT-PSEUDO-OPEN
  title: "Successfully placed order" pseudo-message (status=open)
  owner_route: layout
  current_file: components/chat/chat-view.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, guest_cookie]
  state_branches: [display]
  testid: chat-pseudo-placed-order
  notes: Client-side pseudo-row derived from order.status + viewer role.

- id: GLOBAL-CHAT-PSEUDO-INPROGRESS
  title: "Is preparing your order" pseudo-message (status=in_progress)
  owner_route: layout
  current_file: components/chat/chat-view.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper, guest_cookie]
  state_branches: [display]
  testid: chat-pseudo-in-progress
  notes: Pseudo-row; different variants for orderer vs swiper.

- id: GLOBAL-CHAT-INPUT-ACTIVE
  title: Message composition input
  owner_route: layout
  current_file: components/chat/chat-input.tsx
  backend_contract: POST /api/messages | POST /api/guest/messages
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper, guest_cookie]
  state_branches: [idle, sending, error]
  testid: chat-input-active
  notes: Textarea + Send button. Enter sends; Shift+Enter newline. Optimistic append with temp_id; reconcile via realtime or POST response.

- id: GLOBAL-CHAT-INPUT-DISABLED
  title: Disabled input when conversation closed
  owner_route: layout
  current_file: components/chat/chat-input.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper, guest_cookie]
  state_branches: [disabled]
  testid: chat-input-waiting
  notes: Shown when conversation does not yet exist (order status=open, swiper not yet assigned).

- id: GLOBAL-CHAT-SEND
  title: Send-message button
  owner_route: layout
  current_file: components/chat/chat-input.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper, guest_cookie]
  state_branches: [idle, sending]
  testid: chat-send-button
  notes: Submit affordance for the input.

- id: GLOBAL-CHAT-PHOTO-UPLOAD
  title: Completion-photo upload control (swiper only)
  owner_route: layout
  current_file: components/chat/chat-input.tsx
  backend_contract: POST /api/messages/[orderId]/upload
  realtime: null
  storage: completion-photos
  auth_branches: [authed_swiper]
  state_branches: [idle, uploading, success, error]
  testid: chat-photo-upload
  notes: Camera icon → file picker (jpeg/webp only, 1MB). FormData POST; inserts completion_photo message.

- id: GLOBAL-CHAT-REALTIME-INSERT
  title: Realtime message INSERT subscription
  owner_route: layout
  current_file: hooks/use-messages.ts
  backend_contract: null
  realtime: messages:{conversationId}
  storage: null
  auth_branches: [authed_orderer, authed_swiper, guest_cookie]
  state_branches: [subscribed]
  testid: null
  notes: postgres_changes INSERT filter on conversation_id. Dedupe by message.id. Plan §11 adds subscribe-before-fetch + temp_id reconciliation.

- id: GLOBAL-COMPLETION-BANNER
  title: Swiper completion banner (in_progress only)
  owner_route: layout
  current_file: components/chat/completion-banner.tsx
  backend_contract: PATCH /api/orders/[id]/status
  realtime: null
  storage: completion-photos
  auth_branches: [authed_swiper]
  state_branches: [idle, uploading, completing, unaccepting, error]
  testid: completion-banner
  notes: Hosts "Complete Order" (gated on completion_photo exists) and "Unaccept" buttons. Swiper-only; shown when order.status=in_progress.

- id: GLOBAL-COMPLETION-COMPLETE
  title: Mark-complete button
  owner_route: layout
  current_file: components/chat/completion-banner.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_swiper]
  state_branches: [disabled, ready, completing]
  testid: swiper-complete-order-button
  notes: Enabled only after a completion_photo message exists in the conversation. Money-moving — no optimistic transition.

- id: GLOBAL-COMPLETION-UNACCEPT
  title: Unaccept (return to queue) button
  owner_route: layout
  current_file: components/chat/completion-banner.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_swiper]
  state_branches: [idle, unaccepting]
  testid: swiper-unaccept-button
  notes: PATCH status to 'open' (service client on backend). No optimistic transition.

- id: GLOBAL-ORDER-COMPLETED-VIEW
  title: Completed-order view (replaces chat)
  owner_route: layout
  current_file: components/chat/order-completion-notice.tsx
  backend_contract: null
  realtime: null
  storage: completion-photos
  auth_branches: [authed_orderer, authed_swiper, guest_cookie]
  state_branches: [display]
  testid: order-completed-view
  notes: Renders when order.status=completed. Shows most-recent completion_photo image via signed URL.
```

### Cross-cutting realtime safeguards (Session 07 deliverable)

```yaml
- id: GLOBAL-REALTIME-REGISTRY
  title: Ref-counted realtime channel registry
  owner_route: layout
  current_file: lib/realtime/channel-registry.ts
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper, guest_cookie]
  state_branches: [transparent]
  testid: null
  notes: New file (Session 07). One channel per (name, userId); consumers ref-count. See plan §11.

- id: GLOBAL-REALTIME-VISIBILITY-REFETCH
  title: Visibility-change reconciliation refetch
  owner_route: layout
  current_file: hooks/use-visibility-refetch.ts
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [authed_orderer, authed_swiper, guest_cookie]
  state_branches: [transparent]
  testid: null
  notes: New hook (Session 07). Triggers refetch on tab-visible event to reconcile after WS heartbeat suspension.
```

### Auth principal helper (Session 05 deliverable)

```yaml
- id: GLOBAL-AUTH-PRINCIPAL
  title: Unified principal resolution
  owner_route: layout
  current_file: lib/auth/resolve-principal.ts
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, authed_swiper_pre_stripe, authed_swiper, guest_cookie]
  state_branches: [transparent]
  testid: null
  notes: New file (Session 05). Discriminated union replaces ad-hoc auth branching across UI. See plan §10.
```

---

## Non-flow capabilities (global primitives)

```yaml
- id: GLOBAL-TOAST
  title: Toast notification container
  owner_route: layout
  current_file: components/ui/toast.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, authed_swiper_pre_stripe, authed_swiper, guest_cookie]
  state_branches: [empty, show]
  testid: toast-container
  notes: New primitive (Session 03). Used for optimistic-failure rollbacks and system notices.

- id: GLOBAL-SKELETON
  title: Skeleton loading primitive
  owner_route: layout
  current_file: components/ui/skeleton.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, authed_swiper_pre_stripe, authed_swiper, guest_cookie]
  state_branches: [display]
  testid: skeleton
  notes: New primitive (Session 03). Respects prefers-reduced-motion.

- id: GLOBAL-SURFACE
  title: Tinted surface primitive
  owner_route: layout
  current_file: components/ui/surface.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, authed_swiper_pre_stripe, authed_swiper, guest_cookie]
  state_branches: [display]
  testid: surface
  notes: New primitive (Session 03). Card/panel with tinted background, no border by default.

- id: GLOBAL-SHEET
  title: Mobile bottom-sheet primitive
  owner_route: layout
  current_file: components/ui/sheet.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, authed_swiper_pre_stripe, authed_swiper, guest_cookie]
  state_branches: [closed, open]
  testid: sheet
  notes: New primitive (Session 03). Wraps Radix Dialog + drag-to-dismiss. Used by ChatPanel on small screens.

- id: GLOBAL-MODAL
  title: Centered modal primitive
  owner_route: layout
  current_file: components/ui/modal.tsx
  backend_contract: null
  realtime: null
  storage: null
  auth_branches: [anon, authed_orderer, authed_swiper_pre_stripe, authed_swiper, guest_cookie]
  state_branches: [closed, open]
  testid: modal
  notes: New primitive (Session 03). Wraps Radix Dialog. Used by AccountPanel and delete-account confirm.
```

---

## Summary counts

| Namespace | Count |
|-----------|-------|
| ORD (orderer/guest) | 20 |
| SWIP (swiper) | 24 |
| GUEST (guest-specific) | 4 |
| AUTH (authentication UI) | 13 |
| GLOBAL (shell + shared) | 30 |
| **Total** | **91** |

---

## Change control

- This file is locked at Session 01 close by SHA-256 hash (recorded in `SESSION_LOG.md`).
- Any change requires an entry in `FEATURES_CHANGELOG.md` with: the change, the justification, and the session that made it.
- Scope-creep additions are rejected on sight (see plan's refusal list).
