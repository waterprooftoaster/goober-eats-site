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

npx tsx scripts/seed.ts           # Seed local Supabase with eateries/menu items

supabase start       # Start local Supabase (Docker required)
supabase stop
supabase db push     # Apply migrations to local DB
supabase migration new <name>     # Create a new migration file
```

E2E tests auto-start the dev server if not already running. The `authenticated/` test suite depends on `auth.setup.ts` running first, which writes `.auth/user.json`.

## Architecture

### Domain Model

| Entity | Notes |
|--------|-------|
| `schools` | Top-level tenant (currently NYU) |
| `eateries` | Dining halls and eateries scoped to a school |
| `menu_items` | Belong to an eatery; have `original_price_cents` (what it costs the swiper) and `market_price_cents` (what the orderer pays) |
| `menu_item_option_groups` / `menu_item_options` | Modifiers (size, toppings) with `single`/`multiple` selection |
| `profiles` | Extends Supabase auth users; has `school_id`, `phone` for SMS |
| `orders` | Core entity; `status` ∈ `{open, in_progress, completed, cancelled}`; `guest_access_token` (UUID) is set for guest orders and used to authenticate guest chat |
| `payments` | Created after Stripe PaymentIntent; tracks `platform_fee_cents` (10% of original price) |
| `stripe_accounts` | Swiper's Stripe Connect account; must have `onboarding_complete = true` to accept orders |
| `carts` / `cart_items` | Session-based for guests (cookie `cart_session_id`), user-based for auth'd users |
| `conversations` / `messages` | Created when a swiper accepts an order; supports orderer↔swiper in-order chat |

### Order Lifecycle (Pull System)

Orders flow through a state machine (`lib/orders/state-machine.ts`):

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
- **Orderer** pays via Stripe Checkout. The `payment_intent.succeeded` webhook creates the order in `open` state.
- Accept uses the **service client** for the atomic `swiper_id` claim (RLS can't cover the `null → user` transition); all eligibility checks run first via the user client.
- `completed` requires a succeeded payment record **and** at least one `delivery_photo` message in the conversation.
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

### Guest vs Authenticated Ordering

Both guest and authenticated users go through the same embedded Stripe Checkout session (`/api/stripe/checkout-session`) with a single unified code path. The order is NOT created in the DB until the `payment_intent.succeeded` webhook fires — if the user backs out mid-checkout, nothing hits the DB.

The only differences:
- **Guest**: `guest_name` in Stripe metadata, `orderer_id` is NULL, `guest_access_token` (random UUID) stored on the order
- **Auth**: `orderer_id` in Stripe metadata, no `guest_name`, no `guest_access_token`

Guests access their order chat via `app/api/guest/` routes (`/verify-order`, `/messages`, `/messages/[orderId]`). Authentication uses a `guest_order_token_{orderId}` cookie set at checkout return and validated by `lib/api/guest-auth.ts:validateGuestOrder`.

When a swiper completes any order, `lib/stripe/transfer.ts` creates a Stripe Transfer from the platform to the swiper's connected account.

### Stripe Connect

Swipers must complete Stripe Connect onboarding before accepting orders. The flow is:
1. `POST /api/stripe/connect/create` — creates a Connected Account
2. `POST /api/stripe/connect/onboard` — returns an onboarding URL
3. `account.updated` webhook marks `onboarding_complete = true`

Payments use `application_fee_amount` + `transfer_data.destination` so the 10% platform fee (20% of user payment) stays on the platform and the rest transfers to the swiper's account.

### Chat and Notifications

Order status changes are surfaced via in-app Realtime chat (Supabase Realtime). The `messages` table is published to `supabase_realtime` for INSERT streaming. Delivery photo messages expire after 7 days; text/system messages expire after 48 hours, cleaned up hourly by `public.cleanup_expired_messages()`.

### API Conventions

All routes use helpers from `lib/api/helpers.ts`:
- `apiSuccess(data, status?)` — wraps response in `NextResponse.json`
- `apiError(message, status)` — same pattern for errors
- `getAuthenticatedUser(supabase)` — returns `null` if unauthenticated (never throws)

All request bodies are validated with Zod schemas defined in `lib/types/api.ts` before any DB access.

### Next.js Parallel Routes

The root layout (`app/layout.tsx`) uses `@modal` as a parallel route slot. The cart page at `/cart` is intercepted as a modal via `app/@modal/(.)cart/page.tsx` when navigating client-side; navigating directly renders the full page at `app/cart/page.tsx`.

### Path Alias

`@` maps to the repo root (`/`), configured in both `tsconfig.json` and `vitest.config.ts`.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
SUPABASE_SECRET_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```
