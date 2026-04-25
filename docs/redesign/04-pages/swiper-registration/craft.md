# `/swiper-registration` — Craft

## Anatomy

```
<main data-testid="swiper-registration-page" mx-auto max-w-md py-16 px-6 sm:py-24>
  <SwiperRegistrationForm>
    <header>
      <h1 text-3xl/4xl semibold tracking-tight />  ← "Become a swiper."
      <p text-sm text-muted-foreground />
    </header>

    {error && (
      <p data-testid="swiper-reg-error-message" role="alert" text-destructive />
    )}

    <div>
      <p text-sm font-medium />  ← "Your school"
      {schoolConfirmed ? (
        <p text-sm>{confirmedName}</p>
      ) : (
        <div flex flex-col sm:flex-row sm:items-end>
          <div data-testid="swiper-reg-school-selector" flex-1>
            <Combobox value={selectedSchool} ... autoHighlight>
              <ComboboxInput placeholder="Search schools…" />
              <ComboboxContent>
                <ComboboxList>
                  {schools.map(s => <ComboboxItem value={...}>{s.name}</ComboboxItem>)}
                  {searchQuery.trim().length > 0 && <ComboboxEmpty />}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <Button variant="subtle" data-testid="swiper-reg-save-button"
                  disabled={saving || !selectedSchool}>
            {saving ? 'Saving…' : 'Save school'}
          </Button>
        </div>
      )}
    </div>

    <Button variant="primary" size="lg" data-testid="swiper-reg-continue-button"
            disabled={!schoolConfirmed || connecting} className="w-full">
      {connecting ? 'Opening Stripe…' : 'Continue to payment setup'}
    </Button>
  </SwiperRegistrationForm>
</main>
```

## Decisions

- **`<Combobox>` for the school input.** Replaces the native `<select>`
  for brand consistency with the auth-login school step. Dual-input
  pattern (testid wrapper + Base UI inner input with `role="combobox"`)
  preserved for Playwright disambiguation.
- **`autoHighlight` on the Combobox.** First matching item is
  pre-highlighted so pressing Enter after typing selects it without
  arrow-key navigation. Matches auth-login.
- **No hidden `<input type="hidden" name="school_id">`.** This form
  submits via fetch POST/PATCH (not a server-action FormData
  submission), so the selected school value is read straight from
  component state.
- **`Button variant="subtle"` on Save.** Save is a secondary action;
  it earns the tinted neutral, not the lime. Continue (primary) is the
  one lime CTA per screen.
- **Confirmed-school renders as plain `<p>`** (not as a disabled input
  or pill). The form is short enough that the user can still tell
  what's saved. Removes a row of secondary controls once it's no
  longer needed.
- **`Button variant="primary" size="lg"` + `w-full` Continue.**
  Mirrors `/swiper/orders` Accept button: same primitive shape, same
  full-width treatment, same lime accent. Visual consistency across
  the swiper-onboarding journey.
- **`window.location.href = url` for Stripe redirect.** Same pattern
  the original code used. Stripe Connect onboarding is a hard nav,
  not a Next.js route push.
- **No spinner / skeleton on the page itself.** Server prefetches
  schools before render; Combobox renders filled on first paint.
- **`text-destructive` `role="alert"` `<p>` for errors.** Same shape
  as auth-login + checkout + swiper-orders.

## Behavior preserved (byte-for-byte from S01)

- Two-step gating: `schoolConfirmed` boolean derived from
  PATCH-success or pre-set `schoolId` prop. Continue button stays
  disabled until `schoolConfirmed === true`.
- `handleSaveSchool`: PATCH `/api/profile { school_id }`; on 200 →
  confirm; on non-OK → set error; on network error → set generic
  error.
- `handleContinue`: POST `/api/stripe/connect`; on 200 →
  `window.location.href = url`; on non-OK → set error; on network
  error → set error and unset connecting.
- Save button stays disabled while `saving === true` OR
  `!selectedSchool`.
- Continue button stays disabled while `connecting === true` OR
  `!schoolConfirmed`.

## Testid coverage

| Catalog ID | testid | Element |
|---|---|---|
| SWIP-REG-LOAD | `swiper-registration-page` | `<main>` |
| SWIP-REG-SCHOOL | `swiper-reg-school-selector` | `<div>` wrapping `<Combobox>` |
| SWIP-REG-SAVE-SCHOOL | `swiper-reg-save-button` | Save `<Button>` |
| SWIP-REG-STRIPE | `swiper-reg-continue-button` | Continue `<Button>` |
| SWIP-REG-ERROR | `swiper-reg-error-message` | `<p role="alert">` |

## A11y

- Combobox: Base UI ships `role="combobox"` + `role="listbox"` +
  arrow-key nav + Enter to select + Escape to clear.
- Save / Continue: real `<button type="button">` from primitive,
  with focus-visible rings.
- Error row: `role="alert"` for assertive AT announcement.
- Tokens: focus-visible rings via primitive defaults.

## File hygiene

- `swiper-registration-form.tsx` is 165 LOC (was 121); +44 LOC for the
  Combobox import/wiring + the dual-input wrapper + brand-voice copy.
- `page.tsx` is 60 LOC (was 57); +3 LOC for trailing JSDoc.
- JSDoc headers (`@file`, `@description`, `Called by:`, `@dependencies`)
  on both files.
- Default export first; helpers below `// --- Helpers ---` (none
  needed).

## Vitest specs

`tests/unit/app/swiper-registration/swiper-registration-form.test.tsx`
adds 4 specs (TDD-first, against pre-rebuild native-select impl, then
re-run green against post-rebuild Combobox impl):

1. Continue button is disabled when no school is confirmed.
2. Continue button is enabled when `schoolId` is pre-set.
3. POST `/api/stripe/connect` 200 → `window.location.href` swaps to
   the returned URL.
4. POST `/api/stripe/connect` 500 → error message testid renders with
   server-supplied copy.
