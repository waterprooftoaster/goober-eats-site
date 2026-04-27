# `/swiper/orders` — Craft

## Anatomy

```
<main data-testid="swiper-orders-page" mx-auto max-w-2xl py-8 sm:py-12>
  <header mb-8>
    <h1 text-3xl/4xl semibold tracking-tight />  ← "Open orders."
    <p text-sm text-muted-foreground />
  </header>

  <PendingOrdersList orders={...}>
    <div data-testid="pending-orders-list">
      {successMsg && (
        <Surface
          data-testid="swiper-accept-success-banner"
          role="status"
          className="border border-primary/40 bg-primary/10" />  ← lime tint, NOT primary
      )}
      {error && !selectedOrder && (
        <p role="alert" className="bg-destructive/5 text-destructive" />
      )}

      {orders.length === 0 ? (
        <p data-testid="swiper-orders-empty-state" />
      ) : (
        <ul divide-y divide-border>
          {orders.map(order => (
            <OrderCard order={order} onClick={() => handleOpen(order)} />
          ))}
        </ul>
      )}

      <Modal open={selectedOrder !== null} onOpenChange={handleClose}>
        <ModalContent data-testid="swiper-order-detail-modal">
          <ModalTitle>{selectedOrder.restaurant_name}</ModalTitle>
          <ScreenshotGallery urls={...} />
          <div>Total / formatDollars</div>
          <p bg-muted/40>Double-check the subtotals…</p>
          {error && <p role="alert" />}
          <Button variant="primary" data-testid="swiper-accept-button"
                  disabled={accepting}>
            {accepting ? 'Accepting…' : 'Accept order'}
          </Button>
        </ModalContent>
      </Modal>
    </div>
  </PendingOrdersList>
</main>
```

## Decisions

- **`<Modal>` primitive instead of custom inline overlay.** The S03
  primitive (Radix Dialog) provides focus trap, Escape close, and
  return-focus-to-trigger automatically. The accept state machine lives
  entirely inside `<ModalContent>` and is unchanged. The
  `swiper-order-detail-modal` testid moves onto `<ModalContent>` (which
  also carries the primitive's own `data-testid="modal"`; both coexist).
- **No `<ModalHeader>` / `<ModalFooter>` wrappers.** The detail surface
  doesn't need the header/footer rhythm (one title, one CTA, prose body).
  Keeping the primitive footprint minimal avoids over-decoration.
- **Success banner uses `<Surface tone="subtle">`, NOT `<Toast>`.** Per
  S04/S05 user direction, transient feedback renders inline. Surface
  carries the success copy with a `bg-primary/10` tint (10% lime, NOT
  the full lime accent) so the lime CTA stays unambiguous.
- **Inline error rows split by location.** Top-of-list error banner
  fires when the modal has closed (`!selectedOrder`) — this happens on
  409 (we close the modal AND set error) and after 5xx if the user
  navigates back to the list. In-modal error renders inside
  `<ModalContent>` for 403/5xx where the modal stays open.
- **`text-destructive` for every error.** No `text-red-600` literals
  anywhere; tokens cascade.
- **Order card divider uses `divide-y divide-border`.** Replaces
  `divide-gray-100`. Border tint comes from OKLCH-126 token.
- **`Button variant="primary" size="lg"` on Accept.** Full-width inside
  the modal (`w-full`); soft-disabled with `disabled={accepting}` and
  `'Accepting…'` label. Money-moving — no optimistic transition.
- **Inline warning row uses `bg-muted/40`** (not amber/yellow).
  Brand-correct; the "double-check" copy is informational, not a brand
  warning, so it earns the muted treatment.
- **Empty state is a single `<p text-muted-foreground py-12>`.** No
  illustration, no decorative card. Matches the rest of the redesign.

## Behavior preserved (byte-for-byte from S01)

- `handleAccept` body: 200 → `setOrders.filter` + `setSelectedOrder(null)`
  + `openPanel(id, 'in_progress')` + 5s success banner. 409 →
  `setOrders.filter` + close modal + `setError('That order was just
  accepted by another swiper.')`. Other non-OK → `setError(body.error
  ?? fallback)`. Catch → `setError('Network error…')`.
- `setSuccessMsg` snapshots the restaurant name BEFORE clearing
  `selectedOrder` so the banner reads correctly.
- `setSelectedOrder(null)` always pairs with `setError(null)`.
- Accept button never renders the "accepted" state before the server
  confirms.

## Testid coverage

| Catalog ID | testid | Element |
|---|---|---|
| SWIP-QUEUE-LOAD | `swiper-orders-page` | `<main>` |
| SWIP-QUEUE-LIST | `pending-orders-list` | wrapper `<div>` |
| SWIP-QUEUE-EMPTY | `swiper-orders-empty-state` | empty `<p>` |
| SWIP-QUEUE-DETAIL | `swiper-order-detail-modal` | `<ModalContent>` |
| SWIP-QUEUE-GALLERY | `swiper-screenshot-gallery` | gallery `<div>` |
| SWIP-QUEUE-ACCEPT | `swiper-accept-button` | `<Button variant="primary">` |
| SWIP-QUEUE-ACCEPT-BANNER | `swiper-accept-success-banner` | success `<Surface>` |

(`OrderCard` carries an internal `order-card` testid for E2E reliability;
not catalogued — present in S01 markup as well.)

## A11y

- Modal: Radix Dialog provides focus trap + Escape close + return-focus +
  scroll-lock + `aria-modal` + `aria-labelledby` (auto-wired from
  `<ModalTitle>`). Resolves the three gaps the custom overlay had.
- Lightbox: kept the explicit `role="dialog"` + `aria-modal` + Escape
  handler + named "Close gallery" button. `tabIndex={-1}` + `autoFocus`
  on the wrapper so Escape works immediately.
- Thumbnail buttons: real `<button>` with `aria-label`.
- Banners: success `role="status"`, error `role="alert"`.
- Tokens: focus-visible rings on every interactive element.

## File hygiene

- JSDoc headers (`@file`, `@description`, `Called by:`, `@dependencies`)
  on every new/rewritten file.
- Default export first; helpers below `// --- Helpers ---` separator
  (`error.tsx`'s `sanitize` is the only helper in scope).
- `pending-orders-list.tsx` is 169 LOC (was 146); the +23 LOC is
  Modal-primitive imports + `handleOpen`/`handleClose` extraction +
  Surface/Button primitive boilerplate. Well under the 800-line cap.
- `screenshot-gallery.tsx` stays 100 LOC — only token cascade (no
  structural change).
- `error.tsx` is a new 49-LOC boundary per `02-routes.md §4`.

## Vitest specs (TDD-first)

`tests/unit/app/swiper/orders/pending-orders-list.test.tsx` adds 4
behavioral specs covering the accept state machine:

1. 200 success → `openPanel('order-1', 'in_progress')` + green banner
   text contains restaurant name + row removed (empty state visible).
2. 409 race → row removed + race-condition banner copy + modal closed +
   `openPanel` not called.
3. 403 forbidden → inline error inside modal with server-supplied copy +
   modal stays open + `openPanel` not called.
4. Soft-disable → button `disabled={true}` while fetch is in flight.

Specs were authored BEFORE the Modal swap (TDD) so the swap could not
silently regress the state machine. All 4 pass green against the
post-swap implementation.
