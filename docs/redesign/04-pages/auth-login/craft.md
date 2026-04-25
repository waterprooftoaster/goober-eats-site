# `/auth/login` — Craft

## Anatomy

```
<main data-testid="auth-login-page" mx-auto max-w-sm py-16 px-6>
  <header text-3xl/4xl semibold tracking-tight />  ← per-step heading

  ┌─ effectiveStep === 'email' ───────────────────────────────┐
  │ {callbackError && <p data-testid="auth-callback-error" />}│
  │ <FieldRow><Input data-testid="auth-email-input" /></.>    │
  │ <Button data-testid="auth-continue-button" variant="primary"/>│
  └───────────────────────────────────────────────────────────┘

  ┌─ effectiveStep === 'password' ────────────────────────────┐
  │ {error && <p data-testid="auth-form-error" />}            │
  │ <Button data-testid="auth-back-button" variant="ghost"/>  │
  │ <form action={formAction}>                                │
  │   <input type="hidden" name="email" />                    │
  │   <FieldRow><Input data-testid="auth-password-input"/></.>│
  │   {!emailExists &&                                        │
  │     <FieldRow><Input data-testid="auth-password-confirm-input"/></.>}│
  │   <Button data-testid={emailExists?'auth-signin-button':'auth-signup-button'} variant="primary"/>│
  │ </form>                                                   │
  └───────────────────────────────────────────────────────────┘

  ┌─ effectiveStep === 'name' ────────────────────────────────┐
  │ <FieldRow><Input data-testid="auth-fullname-input"/></.>  │
  │ <Button data-testid="auth-name-continue-button" variant="primary"/>│
  └───────────────────────────────────────────────────────────┘

  ┌─ effectiveStep === 'school' ──────────────────────────────┐
  │ {error && <p data-testid="auth-form-error" />}            │
  │ <Button data-testid="auth-back-button" variant="ghost"/>  │
  │ <form action={onboardingAction}>                          │
  │   <input type="hidden" name="full_name" />                │
  │   <div data-testid="auth-school-input">                   │
  │     <Combobox><ComboboxInput/><ComboboxContent>...</></.>│
  │   </div>                                                  │
  │   <input type="hidden" name="school_id" />                │
  │   <Button data-testid="auth-onboarding-complete-button" variant="primary"/>│
  │ </form>                                                   │
  └───────────────────────────────────────────────────────────┘
</main>
```

## Decisions

- **Layout: left-aligned `max-w-sm` column with `py-16` top padding.**
  Replaces the S01 `fixed inset-0 flex items-center justify-center`
  centered hero — explicitly out per `.impeccable.md` ("no centered
  hero layouts; left-aligned content with intentional white space").
  The form column is intentionally narrower than `/checkout`'s 440px;
  one decision per row reads better when the column is short.
- **State machine bytes preserved.** Every `useState`, every derived
  `effectiveStep`/`effectiveEmail`, the `useActionState` pair, the
  `handleContinue` flow are byte-for-byte from S01. Only the
  presentation changes.
- **`Button variant="primary"` for every step CTA.** `defaultVariants`
  in `button.tsx` is already `primary` so the variant prop is mostly
  redundant — but it's left explicit per the `.impeccable.md` "one
  lime CTA per screen" invariant. Each step shows exactly one primary
  button at a time.
- **`Button variant="ghost"` for Back.** `size="sm"` so it visually
  recedes; arrow glyph is the same `←` character S01 used so screen
  readers keep their existing experience.
- **Inputs through the `Input` primitive.** Carries the OKLCH
  `border-input` + `focus-visible:ring` tokens. No custom inline
  styles for height/padding any more.
- **Combobox wrapper preserved.** The S01 Playwright disambiguation
  `getByTestId('auth-school-input').getByRole('combobox')` depends on
  the wrapper carrying the testid and the inner Base UI input
  carrying the role. The `<div data-testid="auth-school-input">` stays
  exactly where it is.
- **Hidden form fields preserved.** `<input type="hidden" name="email">`
  in the password form, `<input type="hidden" name="full_name">` and
  `<input type="hidden" name="school_id">` in the school form. The
  `authenticate` server action distinguishes signup-vs-signin by
  looking for `confirm_password` in the FormData, so the confirm
  input must keep `name="confirm_password"` whenever it renders.
- **Check-email guard semantics preserved.** Form fires
  `GET /api/auth/check-email` immediately on click; the 300ms guard
  is server-side (timing-attack mitigation in
  `app/api/auth/check-email/route.ts`). The button shows `…` while
  `checkingEmail === true`. **No client-side debounce is added** —
  doing so would change the timing-attack profile.
- **`text-destructive` `<p role="alert">` for both error rows.**
  Matches `/checkout`. No toasts.
- **`FieldRow` helper not needed here.** Every step has at most one
  visible input; the `<label>` semantics live on the heading itself
  ("Enter your password" is functionally the field label) and on the
  hidden fields they don't need labels.
- **Schools prefetched server-side.** `page.tsx` runs the `schools`
  query before render; no skeleton needed. The Combobox renders
  filled on first paint of the school step.
- **Auth-resume detection lives in `page.tsx`.** Server component
  reads `auth.getUser()` + `profiles.select('id').single()` directly
  — *not* via `lib/auth/resolve-principal.ts`. Reason: the helper
  collapses "auth user without profile" into `kind: 'anon'`, which
  loses the email needed to pre-fill the form during resume. The
  helper is the right tool for nav guards and CTA gating, not for a
  state-machine entry-point decision.

## Behavior preserved (unchanged from S01 markup)

- 4-step state machine: email → password → name → school.
- `effectiveStep = (needsOnboarding && step !== 'school') ? 'name' : step`.
- `effectiveEmail` reads from `authState.email` when `needsOnboarding`
  is set; otherwise from local `email` state.
- `Enter` key in the email input triggers `handleContinue`.
- `confirm_password` field visible iff `emailExists === false`.
- `auth-signin-button` vs `auth-signup-button` testid swap on
  `emailExists`.
- Sign-up server action redirects vs returns `{ needsOnboarding,
  email }` driving the resume sub-branch.
- `school_id` hidden input wired off `selectedSchool?.value ?? ''`.
- `formAction` (`authenticate`) and `onboardingAction`
  (`completeOnboarding`) exact pairing preserved.

## Testid coverage

| Catalog ID | testid | Element |
|---|---|---|
| AUTH-LOGIN-LOAD | `auth-login-page` | `<main>` (carries the page identity for visual smoke) |
| AUTH-LOGIN-CALLBACK-ERROR | `auth-callback-error` | `<p role="alert">` above email step heading |
| AUTH-LOGIN-EMAIL-STEP | `auth-email-input` | `<Input type="email">` |
| AUTH-LOGIN-CHECK-EMAIL | (none — transient state on `auth-continue-button`) | n/a |
| (combined) | `auth-continue-button` | email submit `<Button>` |
| AUTH-LOGIN-PASSWORD-STEP | `auth-password-input` | `<Input type="password">` |
| AUTH-LOGIN-PASSWORD-CONFIRM | `auth-password-confirm-input` | `<Input type="password">` (conditional) |
| AUTH-LOGIN-SIGNIN | `auth-signin-button` | password submit (existing-user variant) |
| (combined) | `auth-signup-button` | password submit (new-user variant) |
| AUTH-LOGIN-FORM-ERROR | `auth-form-error` | `<p role="alert">` on password OR school step |
| AUTH-LOGIN-NAME-STEP | `auth-fullname-input` | `<Input type="text">` |
| AUTH-LOGIN-NAME-CONTINUE | `auth-name-continue-button` | name submit `<Button>` |
| AUTH-LOGIN-SCHOOL-STEP | `auth-school-input` | wrapper `<div>` around Combobox |
| AUTH-LOGIN-COMPLETE | `auth-onboarding-complete-button` | school submit `<Button>` |
| AUTH-LOGIN-BACK | `auth-back-button` | step-back `<Button variant="ghost">` |
| AUTH-LOGIN-LOAD | `auth-login-page` | (root) |

(Note: `AUTH-LOGIN-LOAD` testid maps to the page root — same as the
S01 catalog. The page id testid `auth-login-page` is added so visual
smoke can target the page without depending on a specific step
rendering. This is a non-catalog addition; it does not register a new
ID.)

## A11y

- `role="alert"` on every error row — announced to AT.
- `<input type="email">` and `<input type="password">` carry the
  correct virtual-keyboard hints.
- All `<Button>` instances are real `<button type="button">` or
  `<button type="submit">` (no clickable `<div>`s).
- Focus order: heading → callback-error (if present) → input → CTA.
  Back button sits **above** the heading so it's the first
  interactive thing in keyboard tab order on every step ≥ 2 — the
  same convention as the inline arrow-pattern from S01.
- `<Combobox>` (Base UI) ships with `role="combobox"` +
  `role="listbox"` automatically; the `getByRole('combobox')`
  Playwright selector keeps working.

## Error.tsx

**No colocated `app/auth/login/error.tsx`.** Per `02-routes.md §4`,
auth falls through to the global S03 boundary. Adding one would only
duplicate the global empty-state copy.
