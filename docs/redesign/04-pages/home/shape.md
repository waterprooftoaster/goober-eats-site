# `/` — Shape

> Page 1 of Session 04. Feature IDs: `ORD-HOME-LOAD`, `ORD-HOME-FILE-SELECT`,
> `ORD-HOME-UPLOAD`, `ORD-HOME-PLACE-ORDER-CTA`, `ORD-HOME-UPLOAD-ERROR`.
> `ORD-HOME-THUMBNAIL-STRIP` deferred per S04 user-locked scope.

## Job

A first-time visitor lands here phone-in-hand. They want to place an order
in under thirty seconds: pick a screenshot of their GrubHub cart, hit one
button, get to checkout. Anything else is in the way.

## Direction (per `.impeccable.md`)

- **Asymmetric, left-aligned.** No centered hero, no decorative chrome.
  Content sits in a left-aligned `max-w-2xl` rail; the upload zone is a
  square anchored to the left, never centered horizontally.
- **The accent earns its place.** Single lime CTA — the "Place order"
  button. Drop zone is tinted-neutral; hover deepens the dashed border to
  `border-foreground/30`, never to lime.
- **Hierarchy over decoration.** Bricolage Grotesque display heading
  (~3:1 ratio over body), Figtree body, no icon-over-heading, no card
  shadow. Drop zone is a `<Surface tone="subtle" padding="none">` with a
  dashed border — borrowed-receipt feel.
- **Speed signals trust.** Tap-to-upload immediate; preview swap to local
  blob is instantaneous. Loading state is the button label, not a spinner
  in the zone.

## States

| State | Render |
|---|---|
| `idle` | Heading + subhead + empty drop zone (placeholder icon + label). No button. |
| `selected` | Drop zone shows blob preview. Lime "Place order" button below. |
| `uploading` | Same as `selected` but button label switches to "Uploading…" and disables. |
| `error` | Same as `selected` plus inline `text-destructive` paragraph below button. Button re-enabled for retry. |

## Testids

- `home-page` — the `<main>` root
- `home-file-input` — hidden `<input type="file">` (single-file)
- `home-place-order-button` — primary lime CTA
- `home-error-message` — inline error paragraph

`home-thumbnail-strip` and `home-upload-status` deliberately not present
(see deferred scope above).

## Anti-patterns avoided

- Centered hero (was the previous behavior).
- Cards-inside-cards (drop zone is a single Surface, no inner wrapper).
- Spinner inside the drop zone (would compete with preview).
- Lime hover on the drop zone border (lime only on the CTA).
- Auto-redirect on file pick (user must commit via button).
