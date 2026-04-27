# `/checkout` — Craft

## Anatomy

```
<main data-testid="checkout-page" max-w-5xl mx-auto py-6/10>
  <BackButton />
  ┌─ if clientSecret ─────────────────────────────────────────┐
  │ <Surface data-testid="checkout-stripe-embedded">          │
  │   <EmbeddedCheckoutProvider><EmbeddedCheckout /></...>    │
  │ </Surface>                                                │
  └─ else ────────────────────────────────────────────────────┘
  <div grid sm:grid-cols-[1fr_minmax(0,440px)] gap-8>
    <section data-testid="checkout-cart-preview">
      <h2>Your cart</h2>
      {previewUrls.length ? <img(s) /> : <Skeleton aspect-square />}
    </section>
    <section>
      <header><h1>Pay for your order.</h1><p>...</p></header>
      {viewerKind === 'loading'
        ? <FormSkeleton />
        : <CheckoutForm kind={'guest'|'authed'} ... />}
    </section>
  </div>
</main>
```

`<CheckoutForm>`:
```
<form data-testid={'checkout-form-guest'|'checkout-form-authed'}>
  {kind === 'guest' && <FieldRow><Input id="checkout-name" /></FieldRow>}
  <FieldRow><Input id="checkout-eatery" /></FieldRow>
  <FieldRow hint="Minimum $0.50"><Input id="checkout-total" type="number" /></FieldRow>
  {error && <p data-testid="checkout-error-message" role="alert" />}
  <Button type="submit" variant="primary" size="lg"
          data-testid="checkout-submit-button">
    {isSubmitting ? 'Creating session…' :
     totalCents != null ? `Pay $X.XX` : 'Pay'}
  </Button>
</form>
```

## Decisions

- **Auth-branch resolution on the client**: `auth.getUser()` →
  `profiles.select(id).maybeSingle()`. A Supabase user with no profile
  row is treated as a guest because the backend already does. This
  matches `app/api/stripe/checkout-session/route.ts:62-86` exactly.
- **`viewerKind` separate from `stage`**: `viewerKind` is a one-shot
  resolution (loading → guest|authed); `stage` is the form-submission
  state machine (`form | submitting | checkout`). Decoupling keeps the
  conditional render straightforward.
- **One `<CheckoutForm>` component** rather than `<GuestForm>` +
  `<AuthedForm>`: the only structural difference is the conditional
  name field plus the form's testid. Per
  `.claude/rules/common/coding-style.md`'s minimal-code rule
  ("90%+ shared logic → one function with a parameter").
- **Pay button label tracks the typed total** — `Pay $12.50`. Reads as
  "you are paying $12.50" rather than "you are submitting a form."
- **Sessionstorage cleared only after Stripe returns `clientSecret`** —
  preserves retry-with-the-same-screenshots if Stripe fails.
- **`text-destructive` + `role="alert"`** on the error row — picks up
  the OKLCH destructive token and announces to assistive tech.
- **`<Surface>` testid override** — passing `data-testid="checkout-..."`
  overrides Surface's default `data-testid="surface"` because the
  primitive's spread `{...props}` runs after the static attribute.

## Behavior preserved (unchanged from S03 markup)

- sessionStorage `pending_screenshots` array is the source of truth
  for `cart_screenshot_paths`.
- `redirect_no_screenshots` → `router.replace('/')`.
- Total field min `$0.50`, restaurant max 80 chars, name max 100 chars.
- POST body shape unchanged for guests (`guest_name` in payload) and
  unchanged for authed (no `guest_name`).
- Stripe `EmbeddedCheckoutProvider` + `<EmbeddedCheckout />` mount
  unchanged on `clientSecret`.

## Testid coverage

| Catalog ID | testid | Element |
|---|---|---|
| ORD-CHECKOUT-LOAD | `checkout-page` | `<main>` |
| ORD-CHECKOUT-CART-PREVIEW | `checkout-cart-preview` | left `<section>` |
| ORD-CHECKOUT-FORM-GUEST | `checkout-form-guest` | `<form>` (guest variant) |
| ORD-CHECKOUT-FORM-AUTHED | `checkout-form-authed` | `<form>` (authed variant) |
| ORD-CHECKOUT-CREATE-SESSION | `checkout-submit-button` | submit `<Button>` |
| ORD-CHECKOUT-EMBEDDED | `checkout-stripe-embedded` | `<Surface>` wrapping iframe |
| ORD-CHECKOUT-ERROR | `checkout-error-message` | inline `<p role="alert">` |
| ORD-CHECKOUT-BACK | `checkout-back-button` | `<BackButton />` (component-owned) |

## Error.tsx

`app/checkout/error.tsx` (new) — Surface tinted muted, "Try again" + "Go
home" CTAs. Stripe-mount failures and 5xx fallthroughs land here.
