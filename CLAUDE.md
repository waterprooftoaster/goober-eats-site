# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint

npm run test         # Run all unit tests (Vitest + jsdom)
npx vitest run tests/unit/path/to/file.test.ts   # Run a single unit test

npx playwright test               # Run all E2E tests
npx playwright test tests/e2e/home.spec.ts        # Run a single E2E spec

npx tsx scripts/seed.ts           # Seed local Supabase (schools + demo profiles + demo order)

supabase start       # Start local Supabase (Docker required)
supabase stop
supabase db push     # Apply migrations to local DB
supabase migration new <name>     # Create a new migration file
```

E2E tests auto-start the dev server if not already running. The `authenticated/` test suite depends on `auth.setup.ts` running first, which writes `.auth/user.json`.

## Architecture

### Core Concept

Goober Eats no longer hosts menus. An orderer uploads 1+ screenshots of their **GrubHub cart** (including the subtotal) and enters the total they will pay. A swiper at the same school fulfills the order on GrubHub using their meal plan / dining dollars, then posts a **completion photo** (a screenshot of the completed GrubHub order, or a picture of where they left the food) to close out the order.

### Domain Model

| Entity | Notes |
|--------|-------|
| `schools` | Top-level tenant (e.g. NYU, Columbia). Tenancy is enforced: an NYU student cannot order for Columbia. Every `profiles` row has `school_id`; every `orders` row has `school_id`; RLS scopes visibility by `school_id`. |
| `profiles` | Extends Supabase auth users; has `full_name`, `email`, `school_id`, `is_swiper` |
| `orders` | Core entity; `status` ∈ `{open, in_progress, completed, cancelled}`; `school_id` (tenant scope); `restaurant_name` (free-text, e.g. "Chipotle"); `cart_screenshot_urls` (text[], 1..N URLs into the `cart-screenshots` bucket); `total_cents` (int, user-entered total the orderer pays); `guest_access_token` (UUID, set for guest orders) |
| `payments` | Created after Stripe PaymentIntent; tracks `platform_fee_cents` (10% of `orders.total_cents`) |
| `stripe_accounts` | Swiper's Stripe Connect account; must have `onboarding_complete = true` to accept orders |
| `conversations` / `messages` | Created when a swiper accepts an order; supports orderer↔swiper in-order chat. Message types include `text`, `system`, and `completion_photo` |

The former `eateries`, `menu_items`, `menu_item_option_groups`, `menu_item_options`, `carts`, and `cart_items` tables are gone. Any code that referenced them has been removed or rewritten to operate on `orders.cart_screenshot_urls` + `orders.total_cents` instead.

### Order Lifecycle (Pull System)

Orders flow through a state machine (`lib/orders/state-machine.ts`) — **the state machine itself is unchanged**:

```
open → in_progress → completed
  ↘ cancelled       ↗ open (swiper un-accept)
```

Valid transitions:
- `open → in_progress` — swiper accepts (`PATCH /api/orders/[id]/accept`, sets `swiper_id`)
- `open → cancelled` — orderer cancels
- `in_progress → completed` — swiper marks done; triggers Stripe transfer to swiper
- `in_progress → open` — swiper un-accepts (clears `swiper_id`, order re-enters queue)

Key invariants:
- **Orderer** pays via Stripe Checkout. The `payment_intent.succeeded` webhook creates the order in `open` state, persisting `cart_screenshot_urls`, `total_cents`, `restaurant_name`, and `school_id`.
- Stripe Checkout sends a **single line item** with the user-entered `total_cents`; `application_fee_amount` = 10% of that total.
- A swiper can only accept orders with `school_id` matching their own profile's `school_id`.
- Accept uses the **service client** for the atomic `swiper_id` claim (RLS can't cover the `null → user` transition); all eligibility checks run first via the user client.
- `completed` requires a succeeded payment record **and** at least one `completion_photo` message in the conversation.
- Un-accept (`in_progress → open`) also uses the service client because clearing `swiper_id` to `null` fails RLS's `WITH CHECK` on the updated row.
- Stripe transfer happens on `completed`, not as a separate paid state.

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

`completion-photos` replaces the former `delivery-photos` bucket. Rename both the bucket and all references in code / migrations / tests.

### Guest vs Authenticated Ordering

Both guest and authenticated users go through the same embedded Stripe Checkout session (`/api/stripe/checkout-session`). The order is NOT created in the DB until the `payment_intent.succeeded` webhook fires — if the user backs out mid-checkout, nothing hits the DB.

The only differences:
- **Guest**: `guest_name` in Stripe metadata, `orderer_id` is NULL, `guest_access_token` (random UUID) stored on the order
- **Auth**: `orderer_id` in Stripe metadata, no `guest_name`, no `guest_access_token`

Guests access their order via `app/api/guest/` routes — `verify-order` (sets the `guest_order_token_{orderId}` cookie + redirects on success; renders a meta-refresh waiting page while the Stripe webhook is still in flight) and `orders/[orderId]` (reads the order row). Chat messages use the unified `app/api/messages/[orderId]` route, gated by the same cookie via `lib/api/guest-auth.ts:validateGuestOrder`.

When a swiper completes any order, `lib/stripe/transfer.ts` creates a Stripe Transfer from the platform to the swiper's connected account.

### Stripe Connect

Swipers must complete Stripe Connect onboarding before accepting orders. The flow is:
1. `POST /api/stripe/connect/create` — creates a Connected Account
2. `POST /api/stripe/connect/onboard` — returns an onboarding URL
3. `account.updated` webhook marks `onboarding_complete = true`

Payments use `application_fee_amount` + `transfer_data.destination` so the 10% platform fee stays on the platform and the rest transfers to the swiper's account.

### Chat and Notifications

Order status changes are surfaced via in-app Realtime chat (Supabase Realtime). The `messages` table is published to `supabase_realtime` for INSERT streaming. Chat bubbles render text messages only — the `completion_photo` message is NOT displayed in the chat thread. When `order.status === 'completed'` the chat UI is replaced by `OrderCompletedView` (`components/chat/order-completion-notice.tsx`), which renders the most recent `completion_photo` message's `image_url` from the `completion-photos` Supabase Storage bucket. Completion photo messages expire after 7 days; text/system messages expire after 48 hours, cleaned up hourly by `public.cleanup_expired_messages()`.

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
RESEND_API_KEY                # SMTP password for Supabase auth emails
NEXT_PUBLIC_URL               # Base URL used for password-reset / email-confirm callback links
CRON_SECRET                     # Bearer token for /api/cron/sweep-stale-orders.
                                # Set in Vercel project env (Production + Preview)
                                # so Vercel Cron's Authorization header matches.
```

## Production SMTP

Local dev relays auth emails through Inbucket (`http://localhost:54384`). Production uses Resend. The Supabase config block is committed in `supabase/config.toml`, but the hosted Supabase project is configured manually — paste these into Dashboard → Authentication → SMTP Settings after deploy:

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

**Email templates.** The local CLI cluster picks up `supabase/templates/recovery.html` and `supabase/templates/confirmation.html` (link-only — Supabase's default templates also include a 6-digit OTP we don't have a UI for, so we strip it). Custom templates set in `config.toml` only apply to local dev. After deploy, paste the contents of those two files into Dashboard → Authentication → Email Templates → **Confirm signup** and **Reset Password** so the prod emails also drop the OTP line. Leave the **Invite user** and **Magic Link** templates at Supabase defaults — those flows aren't used.
