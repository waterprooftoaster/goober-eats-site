# `/auth/login` — Shape

> Page 6 (Session 05). Feature IDs: `AUTH-LOGIN-LOAD`,
> `AUTH-LOGIN-EMAIL-STEP`, `AUTH-LOGIN-CHECK-EMAIL`,
> `AUTH-LOGIN-PASSWORD-STEP`, `AUTH-LOGIN-PASSWORD-CONFIRM`,
> `AUTH-LOGIN-SIGNIN`, `AUTH-LOGIN-NAME-STEP`,
> `AUTH-LOGIN-NAME-CONTINUE`, `AUTH-LOGIN-SCHOOL-STEP`,
> `AUTH-LOGIN-COMPLETE`, `AUTH-LOGIN-BACK`,
> `AUTH-LOGIN-CALLBACK-ERROR`, `AUTH-LOGIN-FORM-ERROR`.

## Job

A single screen carries the user from "I want to use Goober" to "I'm
signed in with a profile." Four steps (email → password → name →
school), one column, one decision per step. The form has to be calm
enough that someone signing up at 1 AM can finish it without thinking
about it. The onboarding-resume sub-branch — auth user lands here mid-
flow without a profile row — must reuse the same name + school steps,
not feel like a separate flow.

## Direction (per `.impeccable.md`)

- **Left-aligned column** — drop the centered hero from the S01 markup.
  Form sits in a left-aligned `max-w-sm` column with generous top-
  padding so the hierarchy reads "page → step heading → field → CTA"
  top-to-bottom. Asymmetric whitespace on the right so the screen
  doesn't feel like a modal.
- **One lime CTA per step** — `Continue` / `Sign In` / `Sign Up` /
  `Get Started`. Back is a `ghost` button that reads as a quiet escape
  hatch, not a competing action.
- **Tinted Inputs only** — no card wrapping, no shadows. The form
  surfaces blend into the page background. The only chrome that
  exists is the Combobox, because the school step needs a search
  affordance that can't be a plain Input.
- **Display heading per step** — `text-3xl/4xl semibold tracking-tight`
  matching `/checkout`'s heading scale. Steps share visual rhythm so
  the user feels the flow advancing rather than mode-switching.
- **Error row above the active step's heading** — never below the CTA,
  never as a toast (S04 user direction).

## State branches

| Branch | Render |
|---|---|
| `loading` | Server prefetches schools + auth check; if authed-with-profile, redirects to `/` before any DOM. |
| `redirect_authed` | server-side `redirect('/')` — no UI. |
| `email idle` | Email input + Continue button. Optional callback-error banner above the heading. |
| `email validating` | Continue button shows `…` and is disabled. (Inline `emailError` text below input handles client-side regex failure.) |
| `password existing_user` | Hidden email + password input + Sign In button + Back. |
| `password new_user` | Hidden email + password input + confirm-password input + Sign Up button + Back. |
| `password submitting` | Button shows `…` disabled. |
| `password error` | `auth-form-error` row above the heading; form re-enabled. |
| `name idle` | Full-name input + Continue button (disabled until non-empty). |
| `school idle` | Combobox + Get Started button (disabled until selection) + Back. |
| `school submitting` | Get Started shows `…` disabled. |
| `school error` | `auth-form-error` row above the heading; form re-enabled. |

## Auth-resume resolution

The catalog flow 6 onboarding-resume sub-branch is detected **server-
side** in `page.tsx` (existing logic; preserve verbatim):

```
auth.getUser() → null                            ⇒ initialOnboarding=false, render email step
auth.getUser() → user, no profiles row           ⇒ initialOnboarding=true,  render name step (skip email/password)
auth.getUser() → user, has profiles row          ⇒ redirect('/')
```

The form then derives its display step from the union of `step` state
and the `authState.needsOnboarding` flag:

```ts
const effectiveStep = (needsOnboarding && step !== 'school') ? 'name' : step
```

This is preserved byte-for-byte. The new helper
`lib/auth/resolve-principal.ts` is **not** used here — the resume
sub-branch needs both `user` and `profile?.id` separately, while the
helper collapses both into `kind: 'anon'`.

## Testids (every catalogued one ships)

| Testid | Step / context |
|---|---|
| `auth-email-input` | email step |
| `auth-continue-button` | email step submit |
| `auth-password-input` | password step |
| `auth-password-confirm-input` | password step (signup only) |
| `auth-signin-button` | password step (existing user) |
| `auth-signup-button` | password step (new user) |
| `auth-fullname-input` | name step |
| `auth-name-continue-button` | name step submit |
| `auth-school-input` | school step (Combobox wrapper div) |
| `auth-onboarding-complete-button` | school step submit |
| `auth-back-button` | every step ≥ 2 (password, school) |
| `auth-callback-error` | top of email step, when `?error=...` matches allowlist |
| `auth-form-error` | top of password / school step, when server action returns error |

## Errors

- OAuth callback failure (`?error=Could+not+complete+authentication`)
  → red banner above the email step heading. Cleared when the user
  advances out of the email step.
- `authenticate` server action failure (sign-in or signup) → red
  banner above the password step heading. Cleared when the user
  navigates back to email and starts over.
- `completeOnboarding` server action failure → red banner above the
  school step heading. Form re-enabled for retry.
- All errors are inline `<p role="alert" className="text-sm
  text-destructive">`. **No toasts** (S04 user direction).
- No colocated `error.tsx` — generic failures fall through to the
  global S03 boundary (per `02-routes.md §4`).

## Out of scope

- Magic-link login or social SSO buttons (no catalog ID).
- Forgot-password flow (handled by separate `/auth/forgot` route, S07
  scope).
- Password-strength meter (catalog has no testid for it).
- Inline email-existence preview before clicking Continue (the 300ms
  server-side guard runs **after** the click; the form is not allowed
  to leak existence faster than the API allows).
