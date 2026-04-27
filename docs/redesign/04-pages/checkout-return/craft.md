# `/checkout/return` — Craft

## Anatomy

The page itself is a redirect-only server component:

```ts
const { session_id } = await searchParams
if (!session_id) redirect('/')
const session = await stripe.checkout.sessions.retrieve(session_id)
if (!piId) redirect('/')
if (metadata.is_guest === 'true') redirect(`/api/guest/verify-order?pi_id=${piId}`)
redirect('/current-orders')   // ← was '/orders'
```

`error.tsx` (new) renders a tinted `<Surface>` with "Try again" + "Go to
orders" CTAs.

## Decisions

- **Bug fix**: authed redirect target moved from `/orders` to
  `/current-orders` per catalog `ORD-CHECKOUT-RETURN-AUTHED` and master
  plan §Phase 4 exit criterion ("see order in `/current-orders`").
- **No DOM render**: every code path ends in `redirect()`, so there is
  no element to carry `data-testid="checkout-return-page"`. Consistent
  with S01 pre-migration (which also did not add the testid for this
  route — there was no element to bind it to).
- **`error.tsx` directs to /current-orders** in the fallback "Go to
  orders" CTA — payment may have succeeded server-side even if the
  retrieval failed, so the user should land where they'd see the new
  order.

## What stays the same

- Guest branch unchanged: redirect to
  `/api/guest/verify-order?pi_id={pi_id}` so the cookie can be set and
  the guest can be bounced home.
- Silent-fallback to `/` for missing/invalid sessions.
- Stripe SDK call is the same `sessions.retrieve(session_id)`.

## Why no Surface skeleton

The plan called for a brief "Finalizing your order…" Surface. In
practice, the server returns a 302 — no HTML body is sent. Adding a
client-side fallback would (a) flash a loading screen, (b) slow the
transition, (c) introduce a hydration boundary just to host an
unreachable testid. Skipped; behavior is preserved.
