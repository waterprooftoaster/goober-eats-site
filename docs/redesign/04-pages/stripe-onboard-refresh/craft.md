# `/stripe/onboard/refresh` — Craft

## Anatomy

```
<main data-testid="onboard-refresh-page" mx-auto max-w-md py-16 px-6 sm:py-24>
  <Surface tone="subtle" padding="lg" flex flex-col gap-4>
    <header>
      <h1 text-3xl/4xl semibold tracking-tight />  ← "Session expired."
      <p text-sm text-muted-foreground />
    </header>
    <Button variant="primary" asChild>
      <Link href="/swiper-registration">Back to swiper registration</Link>
    </Button>
  </Surface>
</main>
```

## Decisions

- **Mirror /stripe/onboard/complete fallback shape.** Both pages are
  the same surface family — Stripe Connect post-onboarding terminal —
  and reading them as a pair makes the user's mental model
  consistent.
- **One primitive `<Surface tone="subtle">` wrapper.** No card-
  inside-card, no decorative border. The tinted neutral is the only
  structure.
- **`<Button asChild><Link/></Button>`** for the CTA — same pattern
  as /account become-swiper and /stripe/onboard/complete fallback.
- **No `error.tsx` colocation.** No async work; nothing to fail.

## Behavior preserved

- testid `onboard-refresh-page` survives on `<main>`.
- Link target `/swiper-registration` unchanged (catalog
  SWIP-ONBOARD-REFRESH `notes` confirms).
- No data fetches, no auth gates. Stripe redirects here without
  context.

## File hygiene

- 41 LOC (was 32). +9 LOC for primitive imports + `<Surface>` wrapper.
- JSDoc header.
- Default export first.
