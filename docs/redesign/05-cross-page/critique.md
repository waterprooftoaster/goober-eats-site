# Phase 5.5 — `critique` (UX score per role-flow)

> Final cross-page pass. Synthesizes Nielsen heuristic scoring + AI-slop
> verdict + per-role-flow walk-through. Brand-vs-critique tensions
> recorded in `conflicts.md` (BRAND WINS per master plan §Phase 5).

## Method

- LLM design review: read source files for the 13 catalog routes;
  reference `.impeccable.md` brand ground truth + `04-pages/*` craft
  intent.
- Deterministic detector: `npx impeccable --json --fast app components`.
  **Result: `[]` — zero AI-slop tells.**
- Per-flow walk-through across the three role-flows with persona red-flag
  spot-check.

## Design health score (Nielsen 10 heuristics)

| # | Heuristic | Score | Key finding |
|---|---|---|---|
| 1 | Visibility of System Status | 4 | Loading spinners w/ role="status", success banners (swiper accept), in-line "Sending…" / "Uploading…" feedback, status badges on every order surface. |
| 2 | Match System / Real World | 4 | Concrete, mobile-first language: "Place order", "Pay $X", "Open swiper queue", "Accept order". No platform jargon. |
| 3 | User Control and Freedom | 3 | Back button, dismissible chat panels, undo via "Unaccept" button. Intentional gap: no "undo cancel" or "undo complete" — these are money-moving terminal actions per master plan §10. |
| 4 | Consistency and Standards | 4 | Uniform `mx-auto max-w-* + sm:py-*` page roots, OKLCH-126 token palette throughout, semantic HTML (post-audit purge). |
| 5 | Error Prevention | 4 | `disabled={isSubmitting}` on every form, soft-disable (not optimistic) on accept, completion-photo gate on complete. Stripe handles payment validation. |
| 6 | Recognition Rather Than Recall | 4 | Icon nav with aria-labels, restaurant_name surfaced on every order card, status pills with text labels (not color-only). |
| 7 | Flexibility and Efficiency | 3 | Enter-to-send in chat-input. No keyboard shortcuts elsewhere — acceptable for a phone-native gen-z audience (per `.impeccable.md` user context). |
| 8 | Aesthetic and Minimalist Design | 4 | Single lime CTA per screen (verified via `grep size="lg"`). No decorative chrome. Tinted neutrals. Asymmetric left-aligned layouts. |
| 9 | Error Recovery | 3 | Retry on send-fail (chat-input), retry on upload-fail. `error.tsx` boundaries on `/checkout`, `/checkout/return`, `/current-orders`, `/swiper/orders`, `/stripe/onboard/complete`. Some surfaces show error text without retry button (deferred — see P3 below). |
| 10 | Help and Documentation | 2 | NO onboarding, NO tooltips, NO "what is a swiper?" explainer. Relies entirely on contextual copy. **This is intentional brand-aligned minimalism** (`.impeccable.md` principle 5: "minimal chrome"); see `conflicts.md` for the tension. |
| **Total** | | **35/40** | **Excellent** |

## Anti-patterns verdict

**Pass.** Both the LLM read and the deterministic detector agree. Specific
checks:

- **Deterministic scan**: `npx impeccable --json --fast app components`
  → empty array. Zero of the 25 patterns the detector flags appeared.
- **Aesthetic feel**: After the audit-phase gray-* purge, the surface
  reads as the brand intends — Cash App / Robinhood-adjacent fintech
  voice, not consumer-app chrome. The wordmark "**goober** Eats" is
  the only real personality flourish, intentionally per `.impeccable.md`
  ("the 'Goober' name is playful but the product is serious").
- **Layout sameness**: Per-page max-w-* varies by content density (home
  max-w-2xl, checkout max-w-5xl, orders max-w-3xl) — not a one-size
  template.
- **Generic composition**: Asymmetric left-aligned per `.impeccable.md`
  principle 4 — no centered hero layouts.

## Per-flow walk-through

### Orderer flow (anonymous + authed)

**Path**: `/` → upload screenshot → `/checkout` → embedded Stripe →
`/checkout/return` → `/current-orders` (with embedded chat).

- **Strengths**: Single-shot upload (one CTA per screen); Stripe
  Embedded Checkout keeps the user in-context; `/current-orders`
  embeds ChatView so realtime swiper messages arrive without
  navigation.
- **Friction points**: Anonymous user must complete checkout to see
  the chat — but the flow is documented and the anon→authed transition
  happens on the Stripe return path. No major friction.
- **Brand alignment**: Strong. Mobile-first (max-w-md dropzone,
  text-4xl sm:text-5xl hero). Lime CTA earns its place.

### Guest flow (cookie-based track + chat)

**Path**: `/order/[orderId]` (guest token URL) → anon sign-in →
redirect to `/` → ChatPanelProvider auto-opens panel → realtime
chat with assigned swiper.

- **Strengths**: Cookie + anon auth + realtime is sophisticated
  backend; the UX hides this complexity. The user perceives a
  single click → "your order is being prepared" panel opens.
- **Friction points**: Guest doesn't have a persistent account, so
  if they clear cookies they lose access. Acceptable for the use
  case (one-time order tracking).
- **Brand alignment**: Strong. The chat-panel mobile Sheet (vaul)
  feels native, not bolted-on.

### Swiper flow (register → accept → chat → complete)

**Path**: `/swiper-registration` (school + Stripe Connect onboarding)
→ `/swiper/orders` (queue) → modal detail → accept → in-flight chat
panel → completion photo upload → mark complete.

- **Strengths**: Soft-disable accept (no false-optimistic state),
  modal-based detail review (focus-trap + ESC + return-focus),
  completion-photo gate prevents accidental completes, success
  banner with "head to ${restaurant} to start filling it".
- **Friction points**: Stripe Connect onboarding is the longest
  step (multi-step, third-party UI), but unavoidable for a
  payments-platform product.
- **Brand alignment**: Strong. Task-dense layouts (max-w-2xl for
  the queue, modal detail), no decorative chrome, accent earns
  its place on the Accept CTA.

## Persona red flags

### **Alex (Power User — student swiper checking the queue 30× a day)**

- **No keyboard shortcut to accept** — must click into the modal,
  then click Accept. Acceptable: this is a money-moving action and
  the master plan §10 explicitly mandates no shortcut here.
- **No persistent filter on /orders history** — a swiper with 100+
  fulfilled orders has no "Show only this week" affordance. Acceptable
  per refusal-list (master plan §Scope-creep refusal list item 1:
  "Search/filter on orders history").
- **Verdict**: No P0/P1 red flags. The intentional simplicity matches
  the gen-z audience.

### **Jordan (First-timer — new orderer trying to figure out what Goober Eats is)**

- **Home page hero copy is the only orientation** — "Snap your GrubHub
  cart. We pair you with a student who's got swipes — you pay less
  than retail, they pocket the rest." This IS the explainer. No
  onboarding modal, no tour, no "How it works" section.
- **Verdict**: WORKS for a phone-native gen-z user comfortable with
  minimalism. May lose ~10% of less-comfortable users who want more
  hand-holding. Brand-vs-critique tension recorded in `conflicts.md`.

### **Sam (Project-specific persona — orderer with $30 of meal swipes about to expire who wants Chipotle right now)**

- **Friction**: Must take a GrubHub cart screenshot first (vs. just
  typing "Chipotle, $15"). The screenshot requirement is a deliberate
  product decision (post-grubhub pivot — see CLAUDE.md), not a UX gap.
- **Verdict**: The product flow IS the friction. UX is fine.

## Priority issues (P0/P1 actionable)

### [P1] Account modal + swiper detail modal — missing Radix Dialog Description (a11y warning) — FIXED in this commit

S07 test logs reproduced "Warning: Missing `Description` or
`aria-describedby={undefined}` for {DialogContent}." on every
Account-modal render. Radix Dialog requires either a `<Dialog.Description>`
child OR an explicit `aria-describedby={undefined}` to silence the
warning. The S03 `Modal` primitive exports `ModalDescription` but
the two consumers don't use it.

**Fix**: Added `<ModalDescription className="sr-only">…</ModalDescription>`
to both call sites:
- `components/account-panel.tsx`: "Manage your account settings,
  including swiper status and Stripe payouts."
- `app/swiper/orders/pending-orders-list.tsx`: "Review the cart
  screenshots and total for this order before accepting."

Both visible only to screen readers (sr-only). The Radix warning
is silenced at runtime; users with assistive tech now hear a
description on dialog-open.

### [P1] Help/onboarding gap for first-time orderers

Jordan-persona red flag. No "How it works" surface. The home page
hero is the only explainer.

**Brand-vs-critique tension**: `.impeccable.md` mandates minimal
chrome ("the interface should feel like something a discerning student
*chose* to use, not something handed to them by the university").
Adding tooltips, tour modals, or a "How it works" accordion would
contradict this.

**Decision**: BRAND WINS. Recorded in `conflicts.md`. No fix.
Future: a `/clarify` pass on home page microcopy could tighten the
explainer further (within minimalism), but not in S08.

### [P2] Order history status pills — copy could be clearer for orderers viewing their own history

Currently "Open" / "In progress" / "Completed" / "Cancelled" — the
swiper-side perspective. For an orderer viewing their history,
"Open" reads as "still waiting for a swiper." Could be "Awaiting
swiper" / "Being prepared" / "Delivered" / "Cancelled".

**Decision**: Defer. Status copy lives in `app/orders/page.tsx`
(STATUS_LABEL constant); refactoring would need an orderer-vs-swiper
perspective check. Not a P1 — both audiences read context from the
restaurant_name + Placed/Fulfilled badge already.

### [P3] Some error surfaces show text without a retry button

`/checkout` shows error text but the user must click "Pay" again to
retry. `/account` save errors show but no explicit retry. The user
naturally retries by pressing the action button again, so this is
discoverable but not best-practice. Defer.

## What's working

1. **Single CTA discipline**: Every screen has one lime "primary"
   button. No competing accent-color affordances. After audit phase,
   this is mathematically verified — `grep size="lg"` returns one
   per page.
2. **Token-driven theming**: After the audit-phase purge, all colors
   come from the OKLCH-126 brand palette. No raw `gray-*` /
   `red-600` leakage.
3. **Optimistic UI in chat**: appendOptimistic + temp_id round-trip +
   markFailed retry button is invisible until you need it; matches
   `.impeccable.md` principle 3 ("speed signals trust").

## Files changed (in this commit)

```
MODIFIED
  components/account-panel.tsx                                (sr-only ModalDescription)
  app/swiper/orders/pending-orders-list.tsx                   (sr-only ModalDescription)

NEW
  docs/redesign/05-cross-page/critique.md                     (this report)
  docs/redesign/05-cross-page/conflicts.md                    (brand-vs-critique tensions log)
```

## Frozen-surface invariants

`git diff 738e8e7 -- <§9 frozen paths>` adds zero lines on top of the
S07 A07-01 baseline. Edits are at the editable-surface call sites only.
