# Phase 5.4 — `polish` (pre-ship micro pass)

> Final pre-ship quality pass. Adapt + harden + audit phases already
> shipped, so this commit only catches what slipped through. The skill
> warns "over-polishing is its own anti-pattern" — kept tight.

## Findings

After 5.1 adapt (touch targets + responsive), 5.2 harden (edge cases +
3 chat MEDIUMs), and 5.3 audit (a11y + theming purge + dead-code
removal), the surface is in good shape. Targeted scans of polish
dimensions:

| Dimension | Result |
|---|---|
| `console.log` in production frontend | NONE (only in `app/api/stripe/webhooks/route.ts` which is frozen surface and intentionally instrumented) |
| `TODO` / `FIXME` / `XXX` / `HACK` comments | NONE in editable surface (cleared with the dev-chat-trigger.tsx deletion in audit phase) |
| `transition-*` without `motion-reduce:` guard | Only `transition-colors` instances — vestibular-safe per WCAG (color fades don't trigger motion sensitivity); no fix |
| Spacing rhythm consistency | `py-8 sm:py-12` on utility pages vs `py-12 sm:py-16` on home — INTENTIONAL (home has more breathing room as marketing surface) |
| Typography hierarchy | Per-page `text-3xl sm:text-4xl` (sub-heros) and `text-4xl sm:text-5xl` (top hero) — uniform |

## Fixes applied

### Touch-target on chat-input icon buttons (real micro gap)

`components/chat/chat-input.tsx` — Camera + Send buttons used
`size="icon"` (32 px). Below the 44 px touch-target baseline. The
adapt phase fixed `lg` (primary CTAs), but these dense in-composer
icons stayed at 32 px. Mobile users may mis-tap.

**Fix**: added `className="size-11"` (44 px) override at both call
sites. The global `icon` size (32 px) stays — it's used elsewhere in
denser desktop-first contexts. Targeted override avoids touching the
primitive.

Also updated the Camera button's aria-label from "Upload delivery
photo" to "Upload completion photo" (post-grubhub-pivot terminology;
matches the API endpoint's response `message_type: 'completion_photo'`).

## Files changed

```
MODIFIED
  components/chat/chat-input.tsx                              (size-11 on Camera + Send icon buttons; aria-label terminology)

NEW
  docs/redesign/05-cross-page/polish.md                       (this report)
```

## Frozen-surface invariants

`git diff 738e8e7 -- <§9 frozen paths>` adds zero lines on top of the
S07 A07-01 baseline. Only edit is at one editable-surface call site.
