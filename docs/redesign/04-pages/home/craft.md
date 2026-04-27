# `/` — Craft

## Anatomy

```
<main data-testid="home-page" max-w-2xl mx-auto py-12 gap-10>
  <header max-w-md>
    <h1 text-4xl/5xl font-semibold>Order from anywhere on campus.</h1>
    <p text-muted-foreground>Snap your GrubHub cart. … swipes — you pay less.</p>
  </header>
  <div flex-col gap-4>
    <Surface tone="subtle" padding="none"
             aspect-square max-w-md border-dashed border-2 cursor-pointer>
      {preview ? <img object-cover /> : <ImagePlus + "Tap to upload …">}
    </Surface>
    <input type="file" hidden data-testid="home-file-input" />
    {showButton && <Button variant="primary" size="lg" max-w-md
                           data-testid="home-place-order-button" />}
    {error && <p data-testid="home-error-message" text-destructive />}
  </div>
</main>
```

## Decisions

- **`Surface` for the drop zone** — borderless tinted `bg-card`. The
  dashed `border-2 border-border` rides on top via `className`. Hover
  swaps to `border-foreground/30` (warm dark, not lime — keeps lime
  reserved for the CTA per `.impeccable.md`).
- **Icon + label live at the bottom-left** of the empty drop zone (`p-6
  flex-col items-start justify-end`) for left-aligned hierarchy. No
  centered placeholder.
- **`Button variant="primary" size="lg"` w-full max-w-md** — matches
  drop-zone width, becomes the visual anchor on tap.
- **`text-destructive`** for inline error text — picks up the OKLCH
  destructive token rather than a hard-coded `text-red-600`.
- **`motion-reduce:transition-none`** on the hover transition.

## Behavior preserved (unchanged from S03)

- Anonymous sign-in fallback before signing the upload URL.
- File-extension allowlist client-side (`png|jpg|jpeg|webp|heic|heif`).
- `sessionStorage.setItem(PENDING_SCREENSHOTS_KEY, JSON.stringify([path]))`
  with a single-element array — checkout iterates so this stays valid.
- `router.push('/checkout')` after upload success.
- Error surface re-enables the button for retry.

## Testid coverage

| Catalog ID | testid | Element |
|---|---|---|
| ORD-HOME-LOAD | `home-page` | `<main>` |
| ORD-HOME-FILE-SELECT | `home-file-input` | hidden `<input>` |
| ORD-HOME-UPLOAD | (no testid in catalog) | derived state on button label |
| ORD-HOME-PLACE-ORDER-CTA | `home-place-order-button` | primary `<Button>` |
| ORD-HOME-UPLOAD-ERROR | `home-error-message` | `<p>` below button |

`home-dropzone` added as a bonus (not a catalog testid) for E2E hover
tests if needed; not required.

## Out of scope (deferred)

- Multi-file upload, thumbnail strip, per-file upload status
  (`ORD-HOME-THUMBNAIL-STRIP`, `home-upload-status` testid).
- Drag-and-drop styling (catalog allows tap or drag-drop; tap-only is
  acceptable parity with current behavior).
