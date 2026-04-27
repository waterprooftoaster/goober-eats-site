# `/swiper/orders` — Shape

## Role + state branches

Authenticated swiper (full — not pre-stripe; `app/swiper/layout.tsx`
gates) views a list of unclaimed open orders at their school, oldest first.
Tapping a card opens a detail surface (modal) with the cart screenshots,
total, and an Accept button. Accept is "soft-disable, not optimistic"
(master plan §10): the row is removed from the local queue ONLY after a 200
response. 409 surfaces a race-condition banner and removes the row; 403/5xx
renders inline inside the modal so the swiper can retry without losing
context.

State branches the design must absorb:
- `loading` (server fetch — handled by Next.js loading.tsx if present;
  otherwise the page renders synchronously).
- `populated` (≥1 order).
- `empty` (0 orders).
- `detail-modal-open` (selectedOrder !== null).
- `accepting` (button soft-disabled).
- `success-banner` (5s auto-dismiss).
- `race-banner` (sticky until next interaction).
- `inline-modal-error` (403/5xx; modal stays open).

## Brand decisions (`.impeccable.md` ground truth)

- **One lime CTA per screen** — only the Accept button uses
  `<Button variant="primary">`. Order rows are tappable but visually neutral
  (border + hover), the success banner is `bg-primary/10` (10% lime tint,
  not the lime itself), the race-error banner is `bg-destructive/5` (warm
  red, no lime).
- **Asymmetric, left-aligned** — page heading `Open orders.` is `max-w-2xl`
  flush-left, top-padded `py-8 sm:py-12`. No centered hero.
- **Minimal chrome** — order cards have only a hover background change and
  a `divide-y` border between them; no card-inside-card, no decorative
  icons.
- **Tinted neutrals** — modal uses `bg-card` (warm tinted off-white via
  S03 token cascade) instead of pure `bg-white`. The "double-check"
  warning is `bg-muted/40` (no amber/yellow brand violation).
- **Surface primitive for the success banner** — first non-checkout
  consumer of `<Surface tone="subtle">` carrying a status payload.

## Modal primitive swap

The S03 `<Modal>` primitive (Radix Dialog wrapper) replaces the previous
hand-rolled `<div className="fixed inset-0 bg-black/40">` overlay. This
closes three a11y gaps the custom overlay had:

1. **Focus trap** — Radix traps focus inside `<ModalContent>` while open;
   the custom overlay let Tab escape into the page behind.
2. **Escape to close** — Radix wires Escape automatically; the custom
   overlay only closed on backdrop-click and X-button.
3. **Return focus on close** — Radix returns focus to the element that
   opened the modal (the order card); the custom overlay didn't.

The accept state machine lives entirely inside `<ModalContent>` and is
preserved byte-for-byte (`handleAccept` body unchanged). The
`swiper-order-detail-modal` testid moves to `<ModalContent>` (which already
carries `data-testid="modal"` from the primitive itself; both testids
coexist on the same node).

## §10 invariants (preserved verbatim)

- `app/swiper/layout.tsx` server gate — UNTOUCHED. Belt-and-suspenders
  redirect in `page.tsx` survives.
- Accept fetch: `PATCH /api/orders/${id}/accept` — frozen contract.
- Post-accept handoff: `openPanel(orderId, 'in_progress')` — imperative
  call into ChatPanelProvider context. NOT a `router.push`. The chat panel
  for the accepted order opens in the existing global stack.
- 409 race-condition handler: removes row from local queue + closes modal
  + sets `error` state (rendered as the top-of-list red banner because
  the modal closed on 409, so `!selectedOrder` branch fires).
- No optimistic transitions. `disabled={accepting}` on the Accept button.
- ZERO new realtime channels. The queue does not subscribe to
  `orders:open:{schoolId}` or any other channel today, and S06 does not
  introduce one (channel-registry is S07).

## Testid coverage

| Catalog ID | testid | Element |
|---|---|---|
| SWIP-QUEUE-LOAD | `swiper-orders-page` | `<main>` |
| SWIP-QUEUE-LIST | `pending-orders-list` | wrapper `<div>` |
| SWIP-QUEUE-EMPTY | `swiper-orders-empty-state` | empty `<p>` |
| SWIP-QUEUE-DETAIL | `swiper-order-detail-modal` | `<ModalContent>` |
| SWIP-QUEUE-GALLERY | `swiper-screenshot-gallery` | gallery wrapper |
| SWIP-QUEUE-ACCEPT | `swiper-accept-button` | `<Button variant="primary">` |
| SWIP-QUEUE-ACCEPT-BANNER | `swiper-accept-success-banner` | success `<Surface>` |

## A11y

- Modal: focus trap + Escape close + return focus to order card (Radix).
- Lightbox: explicit `role="dialog"` + `aria-modal` + `aria-label` +
  Escape handler + visible Close button. Each thumbnail is a real
  `<button type="button">` with `aria-label="Open screenshot N"`.
- Banners: success row has `role="status"` (polite); error row has
  `role="alert"` (assertive).
- Buttons: focus-visible rings on every interactive element via
  primitive defaults.

## error.tsx

Colocated `app/swiper/orders/error.tsx` per `02-routes.md §4`. Failure
modes warranting a distinct boundary: PATCH /accept 5xx, signed-URL
expiry mid-render, profile lookup failure on the server fetch. Surface
sanitizes the error message (strips paths and stack fragments) and
exposes `error.digest` when present. CTAs: "Try again" (reset) and
"Back to account" (exit the queue cleanly).
