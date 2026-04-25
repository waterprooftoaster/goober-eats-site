# `/checkout` — Shape

> Page 2 of Session 04. Feature IDs: `ORD-CHECKOUT-LOAD`,
> `ORD-CHECKOUT-CART-PREVIEW`, `ORD-CHECKOUT-FORM-GUEST`,
> `ORD-CHECKOUT-FORM-AUTHED`, `ORD-CHECKOUT-CREATE-SESSION`,
> `ORD-CHECKOUT-EMBEDDED`, `ORD-CHECKOUT-ERROR`, `ORD-CHECKOUT-BACK`.

## Job

The user has uploaded a screenshot and committed to paying. They need to
(a) confirm what they're paying for, (b) enter the few fields the swiper
needs, (c) hand the rest to Stripe. The page must feel like a transaction
receipt — calm, structured, no visual noise to make the payment feel
sketchy.

## Direction (per `.impeccable.md`)

- **Asymmetric two-column** on desktop: cart preview anchors the left
  column; form sits in a tighter column on the right (max ~440px). On
  mobile the columns stack — preview on top so the user sees what they
  uploaded before they fill the form.
- **One lime CTA**: the Pay button. BackButton is `ghost`. Form fields
  are tinted Inputs only — no lime borders, no lime focus rings.
- **Minimal chrome**: cart preview is a borderless `<img>` on a tinted
  `bg-card` plate, no shadow, no header bar. The form section has a
  Bricolage display heading + Figtree subtext, no card wrapping.
- **Single source of payment truth**: Pay button label tracks the
  user's typed total — `Pay $12.50` — and falls back to `Pay` when the
  field is empty. Reinforces "paying for this exact amount."

## State branches

| Branch | Render |
|---|---|
| `auth_loading` | Cart preview + a Skeleton stack where the form would be. |
| `form_ready (guest)` | Cart preview + GuestForm (name + restaurant + total). |
| `form_ready (authed)` | Cart preview + AuthedForm (restaurant + total). |
| `submitting` | Pay button label "Creating session…" disabled. |
| `checkout_mounted` | Replace the split layout with a single Surface hosting the Stripe Embedded iframe; BackButton stays at top. |
| `error` | Form intact + inline destructive `<p>` above Pay button; form re-enabled for retry. |
| `redirect_no_screenshots` | `router.replace('/')` — no UI. |

## Auth-branch resolution

Catalog distinguishes `authed_orderer` (real session WITH profile row)
from `[anon, guest_cookie]`. Backend treats Supabase anonymous users
without a profile row as guests too. Frontend mirrors:

```
auth.getUser() → null              ⇒ viewerKind = 'guest'
auth.getUser() → user, no profile  ⇒ viewerKind = 'guest'
auth.getUser() → user, has profile ⇒ viewerKind = 'authed'
```

## Testids (every catalogued one ships)

- `checkout-page` — `<main>` root
- `checkout-cart-preview` — preview column
- `checkout-form-guest` / `checkout-form-authed` — form root (mutually
  exclusive)
- `checkout-submit-button` — primary lime Pay button
- `checkout-stripe-embedded` — Surface wrapping the Stripe iframe
- `checkout-error-message` — inline error `<p>` above Pay button
- `checkout-back-button` — comes from the `<BackButton />` component itself

## Errors

- API non-2xx from `POST /api/stripe/checkout-session` → inline
  `checkout-error-message` with the server-provided message; form
  re-enables for retry.
- Stripe mount/session failure → caught by colocated `error.tsx` (Surface +
  "Try again" + "Go home").
- Empty sessionStorage → silent redirect home (preserve current behavior).

## Out of scope

- Multi-screenshot upload from this screen (home is the upload surface).
- Editing the school field (defaults to deployment's `DEFAULT_SCHOOL_ID`
  for guests; authed users pull from their profile server-side).
- Coupon / promo input — not in catalog.
