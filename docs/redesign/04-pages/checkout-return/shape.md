# `/checkout/return` — Shape

> Page 3 of Session 04. Feature IDs: `ORD-CHECKOUT-RETURN-LOAD`,
> `ORD-CHECKOUT-RETURN-GUEST`, `ORD-CHECKOUT-RETURN-AUTHED`,
> `ORD-CHECKOUT-RETURN-INVALID`.

## Job

Stripe redirects the user back here after embedded checkout. The page
exists for one reason: pick the right downstream destination based on
session metadata, and `redirect()` there. The user should not see this
page at all in the happy path — it's a server-side router.

## Decisions

- **Pure server-side redirect** — no client component, no hydration, no
  render. The S03 layout's global skeleton briefly covers any latency.
- **Authed branch fixed**: catalog `ORD-CHECKOUT-RETURN-AUTHED` says
  `/current-orders`; current code goes to `/orders`. This session
  corrects it. Master-plan §Phase 4 happy-path smoke test depends on
  the fix.
- **No `checkout-return-page` testid in DOM** — the page never renders
  HTML to the user, so the catalog testid has no element to attach to.
  This matches what S01 pre-migration shipped (also no testid) and is
  consistent with the route's redirect-only behavior.
- **Error boundary added** — colocated `error.tsx` for the rare case
  when an exception escapes the Stripe `try/catch` (e.g. an SDK panic
  during retrieval). Renders a tinted Surface with "Try again" + "Go
  home" CTAs.

## Branches preserved (unchanged behavior)

| Branch | Action |
|---|---|
| `!session_id` | `redirect('/')` |
| Stripe SDK throws | `redirect('/')` |
| `!session.payment_intent` | `redirect('/')` |
| `metadata.is_guest === 'true'` | `redirect('/api/guest/verify-order?pi_id=…')` (sets cookie + bounces) |
| Authed | `redirect('/current-orders')` ← fix |
