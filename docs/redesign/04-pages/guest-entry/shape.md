# `/order/[orderId]` — Shape

> Page 7 (Session 05). Feature IDs: `GUEST-ENTRY-LOAD`,
> `GUEST-ENTRY-TOKEN-INVALID`, `GUEST-ENTRY-ANON-SIGNIN`,
> `GUEST-ENTRY-BOOTSTRAP-SPINNER`.

## Job

A guest pays via Stripe Checkout. Stripe redirects them through
`/checkout/return` → `/api/guest/verify-order` → here. This page is a
~1-second handshake: validate the cookie, sign the visitor in
anonymously, associate the anon user with the order, open the chat
panel, redirect home. The user shouldn't be aware this page even
existed — the only artefact they see is a calm spinner before the
panel pops up at the bottom-right of `/`.

## Direction (per `.impeccable.md`)

- **Spinner-only page**, no chrome. The whole thing is gone in ~1s,
  so adding a Surface or a card would be visual noise that the user
  registers right before it disappears.
- **Tinted spinner using OKLCH tokens** — `border-border` for the
  ring, `border-t-foreground` for the moving arc. Replaces S01's
  hard `border-gray-300 / border-t-gray-900`.
- **Page background blends** — no inset, no shadow, no border
  around the spinner. The home page's chrome takes over the moment
  the redirect resolves.

## State branches

| Branch | Render |
|---|---|
| `validating` | Server-side checks running. No DOM (it's a server component). |
| `redirect_invalid_token` | `redirect('/')` — no UI. |
| `redirect_authed_user` | `redirect('/')` — no UI (any session, anon or authed, means panel is owned by `ChatPanelProvider` not by this page). |
| `bootstrap_spinner` | `<div data-testid="guest-panel-opener">` + centered spinner. ~1s lifespan. |
| (transient) signing_in / associating / opening_panel / redirecting | Same DOM as bootstrap_spinner — sub-states are async work, not separate render trees. |

## Server gate

Order of operations in `page.tsx` (preserve verbatim):

1. UUID-validate `params.orderId` (zod). Invalid → `redirect('/')`.
2. `supabase.auth.getUser()`. Any user → `redirect('/')` (the page is
   only for genuinely-unauthenticated guests; existing anonymous
   sessions are owned by `ChatPanelProvider`).
3. Read `guest_order_token_<orderId>` cookie. Missing → `redirect('/')`.
4. **Service-client** lookup against `orders` for `id, status,
   guest_access_token, orderer_id, restaurant_name` (this session
   replaces the stale `eateries(name)` join — the eateries table is
   gone per CLAUDE.md domain-model rewrite; `orders.restaurant_name`
   is the new source of truth).
5. Reject if `!order || order.guest_access_token !== token ||
   order.orderer_id !== null` → `redirect('/')`.
6. Render `<GuestPanelOpener orderId initialStatus eateryName />`.

The frozen path `lib/api/guest-auth.ts` provides
`guestOrderCookieName(orderId)` and `validateGuestOrder()`. We read
`guestOrderCookieName` here; we don't call `validateGuestOrder`
because that helper is built for API routes (returns a `NextResponse`
on failure) and we need a `redirect()` here.

## Client bootstrap

Order of operations in `guest-panel-opener.tsx` (preserve verbatim):

1. `supabase.auth.signInAnonymously()` — fire-and-forget on error.
2. On success: `PATCH /api/guest/orders/<orderId>` with
   `{ anon_user_id: data.session.user.id }`. **Fire-and-forget on
   error** (server-side idempotency means the next visit retries).
3. `openPanel(orderId, initialStatus, eateryName)` via the
   `useChatPanel()` context.
4. `router.replace('/')`.

PATCH is frozen surface (master plan §9 + 02-routes.md §5). Don't
touch the request body or response handling.

## Testids (every catalogued one ships)

| Testid | Element |
|---|---|
| `guest-panel-opener` | Root `<div>` containing the spinner |
| `guest-bootstrap-spinner` | The actual rotating circle |

## Errors

- All server-side rejections are silent `redirect('/')`. No error
  page; no toast. Reason: a leaked guest token landing on this URL
  has no recourse on this page anyway, and the home page is the only
  meaningful place for them to retry.
- Client-side `signInAnonymously` failure: log nothing, fall through
  to `openPanel` + `router.replace('/')` so the user lands somewhere
  useful even if association failed.
- Client-side PATCH failure: ignored (server idempotency: next visit
  re-associates).

## Out of scope

- Inline chat-panel rendering on this page (panel is owned by the
  global `ChatPanelProvider` after the redirect).
- Error UI for invalid tokens (silent redirect by design).
- Loading copy / brand wordmark on the spinner page (the page is too
  brief to read; copy would just flash and disappear).
