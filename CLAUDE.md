# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint

npm run test         # Run all unit tests (Vitest + jsdom)
npx vitest run tests/unit/path/to/file.test.ts   # Run a single unit test

npx playwright test               # Run all E2E tests (auto-starts the test dev server on :3100)
npx playwright test tests/e2e/home.spec.ts        # Run a single E2E spec

npx tsx scripts/seed.ts           # Seed local DEV Supabase (schools + demo profiles + demo order)

supabase start       # Start local DEV Supabase (Docker required)
supabase stop
supabase db push     # Apply migrations to local DEV DB
supabase migration new <name>     # Create a new migration file
```

### Test database (separate Supabase instance — never touches dev)

E2E specs and the optional Stripe-CLI roundtrip test target a dedicated test Supabase, NOT the dev DB. Two parallel `supabase` instances coexist: `supabase/` (dev, default project_id) and `supabase-test/` (project_id "test", ports 64361-64364).

```bash
npm run test:db:up                                     # Start the test Supabase (one-time per boot)
npm run test:db:down                                   # Stop it
npm run test:db:reset                                  # Re-apply migrations (e.g. after a destructive test)

# Live-money flow (real Stripe test-mode money + real webhook)
eval $(bash scripts/test-money-up.sh)                  # Spawn test dev server on :3100 + `stripe listen`; exports STRIPE_WEBHOOK_SECRET
RUN_LIVE_MONEY=1 npx playwright test --project=live-money    # Real Stripe test-mode money flow against the test DB
STRIPE_CLI=1 npx vitest run tests/unit/stripe/webhook-cli-roundtrip.test.ts   # `stripe trigger` → real webhook → test DB
bash scripts/test-money-down.sh                        # Tear down the test dev server + stripe listen (test DB stays up)
```

The `authenticated/` and `live-money` Playwright projects depend on `auth.setup.ts` running first, which creates two seeded users (`orderer@goobereats.edu`, `swiper@goobereats.edu`) in the test Supabase and writes `.auth/orderer.json` + `.auth/swiper.json`. The swiper gets a real Stripe Connect Express account so transfers settle in test mode.

The test Supabase mirrors prod-like settings: `enable_confirmations = true` is on (`supabase-test/supabase/config.toml`), and `templates/{confirmation,recovery}.html` emit `{{ .Token }}` so signup E2E tests scrape the 6-digit OTP from Inbucket on port `64364`. Tests that bypass email confirmation use the admin API (`auth.admin.createUser({ email_confirm: true })`).

Setup requirements: copy `.env.test.example` → `.env.test` and paste the keys printed by `npx supabase status --workdir supabase-test`. STRIPE_SECRET_KEY (test mode, `sk_test_*`) must also be set in `.env.local`.

## Architecture

### Core Concept

Goober Eats no longer hosts menus. An orderer uploads 1+ screenshots of their **GrubHub cart** (including the subtotal) and enters the total they will pay. A swiper at the same school fulfills the order on GrubHub using their meal plan / dining dollars, then posts a **completion photo** (a screenshot of the completed GrubHub order, or a picture of where they left the food) to close out the order.

### Domain Model

| Entity | Notes |
|--------|-------|
| `schools` | Top-level tenant (e.g. NYU, Columbia). Tenancy is enforced: an NYU student cannot order for Columbia. Every `profiles` row has `school_id`; every `orders` row has `school_id`; RLS scopes visibility by `school_id`. |
| `profiles` | Extends Supabase auth users; has `full_name`, `email`, `school_id`, `is_swiper` |
| `orders` | Core entity; `status` ∈ `{open, in_progress, completed, cancelled}`; `school_id` (tenant scope); `restaurant_name` (free-text, e.g. "Chipotle"); `cart_screenshot_urls` (text[], 1..N URLs into the `cart-screenshots` bucket); `total_cents` (int, user-entered total the orderer pays); `guest_access_token` (UUID, set for guest orders); `swiper_assigned_at` (timestamptz, set when a swiper accepts) |
| `payments` | Created after Stripe PaymentIntent authorization; tracks `platform_fee_cents` (10% of `orders.total_cents`), `payment_intent_id` (used to capture/cancel the auth hold), `transfer_failed_at` (set when the post-completion transfer to the swiper fails — order still completes) |
| `stripe_accounts` | Swiper's Stripe Connect account; must have `onboarding_complete = true` to accept orders. `suspended = true` is a hard gate set by the `account.updated` webhook when Stripe permanently terminates the connected account. |
| `conversations` / `messages` | Created when a swiper accepts an order; supports orderer↔swiper in-order chat. Message types include `text`, `system`, and `completion_photo`. |
| `complaints` | One row per order, max one (UNIQUE on `order_id`). Created by the orderer within 24h of completion; AI verdict in `verdict` ∈ `{approve_refund, deny, escalate}`; `refund_id` set when an `approve_refund` triggered a Stripe refund inline. |

The former `eateries`, `menu_items`, `menu_item_option_groups`, `menu_item_options`, `carts`, and `cart_items` tables are gone. Any code that referenced them has been removed or rewritten to operate on `orders.cart_screenshot_urls` + `orders.total_cents` instead.

### Order Lifecycle (Pull System)

Orders flow through a state machine (`lib/orders/state-machine.ts`):

```
open → in_progress → completed
  ↘ cancelled       ↗ open (swiper un-accept)
```

Valid transitions:
- `open → in_progress` — swiper accepts (`PATCH /api/orders/[id]/accept`, sets `swiper_id` + `swiper_assigned_at`).
- `open → cancelled` — orderer cancels (or the 24h sweep cancels). Releases the Stripe auth hold via `paymentIntents.cancel`.
- `in_progress → completed` — swiper marks done; **captures** the orderer's auth hold and transfers the net to the swiper (see Manual Capture below).
- `in_progress → open` — swiper un-accepts (clears `swiper_id`, order re-enters queue). Also fires when the swiper is suspended mid-order.

Key invariants:
- Stripe Checkout sends a **single line item** with the user-entered `total_cents`; `application_fee_amount` = 10% of that total.
- A swiper can only accept orders with `school_id` matching their own profile's `school_id`.
- Accept uses the **service client** for the atomic `swiper_id` claim (RLS can't cover the `null → user` transition); all eligibility checks run first via the user client.
- `completed` requires a successful capture **and** at least one `completion_photo` message in the conversation. Capture failure blocks completion (caller responds 409 and rolls back the order status). Transfer failure does NOT block completion — the food was delivered, the orderer was charged; ops resolve stuck transfers via `payments.transfer_failed_at`.
- Un-accept (`in_progress → open`) also uses the service client because clearing `swiper_id` to `null` fails RLS's `WITH CHECK` on the updated row.

### Manual Capture (Auth Holds)

Orderer payments use `capture_method: 'manual'`. At checkout the funds are **authorized** but not captured — Stripe holds the amount on the orderer's card for up to 7 days. Capture happens when the swiper completes the order, via `lib/stripe/capture-and-transfer.ts`:

1. `stripe.paymentIntents.capture(paymentIntentId)` — captures the held amount.
2. `stripe.transfers.create({ destination: swiperAcct, amount: net })` — moves the net (total minus 10% fee) to the swiper.

Cancellations release the hold instead of capturing:
- **Orderer cancel** (`PATCH /api/orders/[id]/status` with `cancelled`) → `stripe.paymentIntents.cancel(paymentIntentId)`.
- **24-hour sweep** (`/api/cron/sweep-stale-orders`) → same path; auto-cancels any order stuck in `open` or `in_progress` for >24h. Vercel Cron hits this every 15 min using `Authorization: Bearer ${CRON_SECRET}`.
- **Swiper suspended mid-order**: the `account.updated` webhook flips `stripe_accounts.suspended=true` and un-accepts every in-flight order (`in_progress → open`) so a different swiper can pick it up.

### Two Supabase Clients

```
lib/supabase/server.ts   — Cookie-based SSR client (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)
                           Use for all authenticated user operations; respects RLS
lib/supabase/service.ts  — Service role client (SUPABASE_SECRET_KEY)
                           Bypasses RLS; use only for server-side operations that anon/user roles can't do
                           (e.g., guest order inserts, creating conversations, sending notifications)
```

Never use the service client in client-side code or where RLS should apply.

### Storage Buckets

| Bucket | Contents | Access |
|--------|----------|--------|
| `cart-screenshots` | Orderer's GrubHub cart screenshots (1..N per order) | Orderer can insert + read own; assigned swiper can read; guest-token holder can read. Signed URLs preferred. |
| `completion-photos` | Swiper's proof that the order is complete — either a screenshot of the completed GrubHub order, or a photo of where they physically left the food | Swiper assigned to the order can insert; orderer (or guest-token holder) can read. |

`completion-photos` replaces the former `delivery-photos` bucket.

### Authentication

Sign-up and password reset are **OTP-only** — no magic links. The `app/auth/callback` route was removed; PKCE code exchange is no longer used.

- **Sign-up**: `app/auth/login/login-form.tsx` runs a multi-step flow: email → password → **otp** → name → school. `supabase.auth.signUp({ email, password })` is called without `emailRedirectTo`; Supabase emails the 6-digit token rendered by `supabase/templates/confirmation.html` (`{{ .Token }}`). The same tab calls `verifySignupOtp` (`app/auth/actions.ts`), which invokes `supabase.auth.verifyOtp({ email, token, type: 'signup' })`. On success the page hard-loads `/auth/login`, which detects authed-no-profile and shows the inline name/school onboarding step.
- **Password reset**: `app/auth/forgot-password/forgot-form.tsx` mirrors the OTP step. `requestPasswordReset` calls `resetPasswordForEmail(email)` (no `redirectTo`); `verifyRecoveryOtp` exchanges the code for a recovery session; the form then hard-loads `/auth/reset-password`, which already accepts any active recovery session and calls `updateUser({ password })`.
- **Resend cooldown**: `components/ui/resend-code-button.tsx` is a 20-second-cooldown button reused on both OTP steps. It mounts disabled (`Resend in 20s`), unlocks at zero, fires the resend action (`resendSignupOtp` or `resendRecoveryOtp` — both server actions that call `supabase.auth.resend` / `resetPasswordForEmail` respectively), and re-locks for the next window.
- **Onboarding hard-reload**: every successful auth-flow termination uses `window.location.assign(...)` rather than `redirect()` so the SSR header re-fetches the principal and chat/Realtime providers are torn down with the prior session.

Why OTP-only: the magic-link flow broke unpredictably (PKCE code-verifier cookie required the same browser; email-link prefetchers consumed one-time tokens; URL rewriters stripped query params; success landed in a second tab leaving the original tab stuck). OTP is single-tab by construction.

### Guest vs Authenticated Ordering

Both guest and authenticated users go through the same embedded Stripe Checkout session (`/api/stripe/checkout-session`). The order is NOT created in the DB until the `payment_intent.succeeded` (auth-hold success) webhook fires — if the user backs out mid-checkout, nothing hits the DB.

The only differences:
- **Guest**: `guest_name` in Stripe metadata, `orderer_id` is NULL, `guest_access_token` (random UUID) stored on the order
- **Auth**: `orderer_id` in Stripe metadata, no `guest_name`, no `guest_access_token`

Guests access their order via `app/api/guest/` routes — `verify-order` (sets the `guest_order_token_{orderId}` cookie + redirects on success; renders a meta-refresh waiting page while the Stripe webhook is still in flight) and `orders/[orderId]` (reads the order row). Chat messages use the unified `app/api/messages/[orderId]` route, gated by the same cookie via `lib/api/guest-auth.ts:validateGuestOrder`.

**Guest-order claim on signup**: `lib/auth/claim-guest-orders.ts` finds every order whose `guest_access_token` cookie is in the request, attaches them to the new user (`orderer_id := auth.uid()`, `guest_access_token := null`), and clears the cookies. It runs from both `authenticate` (sign-in) and `completeOnboarding` (sign-up).

### Stripe Connect

Swipers must complete Stripe Connect onboarding before accepting orders. The flow is:
1. `POST /api/stripe/connect/create` — creates a Connected Account
2. `POST /api/stripe/connect/onboard` — returns an onboarding URL
3. `account.updated` webhook marks `onboarding_complete = true`. The same webhook flips `suspended = true` when Stripe disables/restricts the account; suspended swipers cannot sign in (the auth flow force-signs-out and surfaces "This account has been suspended."), and any in-flight orders are auto-un-accepted.

Payments use `application_fee_amount` + `transfer_data.destination` so the 10% platform fee stays on the platform and the rest transfers to the swiper's account on completion.

### Chat and Notifications

Order status changes are surfaced via in-app Realtime chat (Supabase Realtime). The `messages` table is published to `supabase_realtime` for INSERT streaming. Chat bubbles render text messages only — `system` and `completion_photo` messages are NOT displayed in the chat thread but are derived as **client-side pseudo-messages** based on `order.status` + viewer role (orderer vs swiper). When `order.status === 'completed'` the chat UI is replaced by `OrderCompletedView` (`components/chat/order-completion-notice.tsx`), which renders the most recent `completion_photo` message's `image_url` from the `completion-photos` Supabase Storage bucket. Completion photo messages expire after 7 days; text/system messages expire after 48 hours, cleaned up hourly by `public.cleanup_expired_messages()`.

The swiper queue (`/swiper/orders`) subscribes to `orders` INSERT/UPDATE on its school_id and patches the list in place — new orders appear without a refresh, and orders that flip away from `open` (accepted by another swiper, cancelled, swept) drop out instantly.

### AI Features

Two AI surfaces, both routed through Vercel AI Gateway when `AI_GATEWAY_API_KEY` is set, otherwise direct provider calls:

- **Cart-total prefill** (`lib/ai/extract-cart-total.ts`, `app/api/orders/extract-price/route.ts`): on home-page screenshot upload, the API returns the extracted total in cents using Gemini (`@ai-sdk/google` with `GOOGLE_GENERATIVE_AI_API_KEY` for direct calls). Prefills the "total you will pay" field on the checkout page. Returns null on any failure (model error, schema violation, sanity-bound breach) — the UI silently leaves the field empty.
- **Complaint adjudication** (`lib/ai/complaint-adjudicator.ts`, `app/api/orders/[id]/complaints/route.ts`): orderer files a complaint within 24h of completion; the adjudicator inspects cart screenshots + completion photo + reason text and returns `approve_refund | deny | escalate`. `approve_refund` triggers a `stripe.refunds.create` inline; the other two surface for human review. Mock mode (no `AI_GATEWAY_API_KEY`) returns `escalate` so the feature ships safely before the gateway key is provisioned. The `reasonText` field is treated as untrusted user data and fenced with `<<<USER_REASON>>>` markers; the system prompt instructs the model to ignore any instructions inside the fence.

### API Conventions

All routes use helpers from `lib/api/helpers.ts`:
- `apiSuccess(data, status?)` — wraps response in `NextResponse.json`
- `apiError(message, status)` — same pattern for errors
- `getAuthenticatedUser(supabase)` — returns `null` if unauthenticated (never throws)

All request bodies are validated with Zod schemas defined in `lib/types/api.ts` before any DB access.

### Path Alias

`@` maps to the repo root (`/`), configured in both `tsconfig.json` and `vitest.config.ts`.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
SUPABASE_SECRET_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY                   # SMTP password for Supabase auth emails (prod)
NEXT_PUBLIC_URL                  # Base URL — used by Stripe Checkout return URLs and
                                 # Connect onboarding return URLs. NOT used for auth
                                 # email links anymore (auth is OTP-only).
CRON_SECRET                      # Bearer token for /api/cron/sweep-stale-orders.
                                 # Set in Vercel project env (Production + Preview)
                                 # so Vercel Cron's Authorization header matches.
AI_GATEWAY_API_KEY               # Optional. Routes Gemini / GPT calls through Vercel
                                 # AI Gateway (observability, fallbacks, key isolation).
                                 # When unset, Gemini falls back to the direct provider
                                 # (GOOGLE_GENERATIVE_AI_API_KEY) and the complaint
                                 # adjudicator runs in mock mode (always 'escalate').
GOOGLE_GENERATIVE_AI_API_KEY     # Direct Gemini API key. Used by extract-cart-total
                                 # when AI_GATEWAY_API_KEY is unset.
```

## Production SMTP

Local dev relays auth emails through Inbucket (`http://localhost:54464`). Production uses Resend. The Supabase config block is committed in `supabase/config.toml`, but the hosted Supabase project is configured manually — paste these into Dashboard → Authentication → SMTP Settings after deploy:

| Field | Value |
|---|---|
| Enable Custom SMTP | on |
| Sender email | `noreply@goobereats.net` |
| Sender name | `Goober Eats` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the `RESEND_API_KEY` env var (project secret) |
| Minimum interval between emails | leave default |

`goobereats.net` is verified in the Resend dashboard.

**Email templates.** The local CLI cluster picks up `supabase/templates/confirmation.html` and `supabase/templates/recovery.html` — both render the 6-digit OTP via `{{ .Token }}` (no link, no PKCE). Custom templates set in `config.toml` only apply to local dev. After deploy, paste the contents of those two files into Dashboard → Authentication → Email Templates → **Confirm signup** and **Reset Password**. Leave the **Invite user** and **Magic Link** templates at Supabase defaults — those flows aren't used.
