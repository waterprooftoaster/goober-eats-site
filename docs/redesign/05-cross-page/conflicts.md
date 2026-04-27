# Brand-vs-Critique Conflicts (Phase 5.5)

> Per master plan §Phase 5: when `critique` skill output conflicts with
> `.impeccable.md` brand direction, **BRAND WINS**. This file records
> each tension so future contributors understand WHY the redesign chose
> the brand path, not the conventional UX-best-practice path.

## C-01 — Help / onboarding minimalism

- **Critique would say**: "Add a 'How it works' surface, first-run
  tooltips, or an explainer modal so first-time orderers don't bounce."
  Nielsen heuristic 10 (Help and Documentation) scored 2/4 because of
  this gap.
- **Brand says** (`.impeccable.md` principle 5 + brand personality
  section):
  - "Minimal chrome — The header is nearly invisible. No cards-inside-
    cards. No rounded icon-background squares above every heading.
    Surfaces blend into the background. Only structure that carries
    meaning gets to exist."
  - "The interface should feel like something a discerning student
    *chose* to use, not something handed to them by the university."
  - The home page hero copy ("Snap your GrubHub cart. We pair you with
    a student who's got swipes — you pay less than retail, they pocket
    the rest.") IS the explainer.
- **Resolution**: BRAND WINS. No tooltips, no tour, no "How it works"
  accordion. Future: a `/clarify` pass could tighten the home hero
  microcopy further within the minimalism budget, but not in S08.

## C-02 — No "undo accept" / "undo complete" affordance

- **Critique would say**: Nielsen heuristic 3 (User Control and
  Freedom) ideally allows undo on every action.
- **Brand + product says** (master plan §10 safe-optimistic-UI table):
  These are money-moving terminal actions:
  - Accept opens a Stripe payment intent commitment to the swiper.
  - Complete triggers a Stripe Transfer to the swiper's connected
    account.
  - "Undo" would mean reversing money movement post-fact, which
    Stripe's API doesn't support cleanly and which would create a
    refund-bot abuse vector.
- **Resolution**: PRODUCT + BRAND WIN. Soft-disable on accept (no
  optimistic state), completion-photo gate on complete (intent
  proof), and Unaccept available as a one-shot return-to-open
  transition while the order is still in_progress. No persistent
  undo.

## C-03 — No order history search / filter

- **Critique would say**: Power users (Alex persona) want filter
  affordances on `/orders`.
- **Brand + master plan say**: Master plan §Scope-creep refusal list
  item 1 explicitly excludes "Search/filter on orders history." Most
  students will have <50 orders/year. The chronological newest-first
  list with role badges is sufficient.
- **Resolution**: REFUSAL-LIST WINS. No fix.

## C-04 — Single-density button sizes (no XS-size primary CTA)

- **Critique would say**: Nielsen heuristic 7 (Flexibility and
  Efficiency) sometimes calls for compact alternates of primary
  CTAs in dense UIs.
- **Brand says**: Single CTA per screen at `lg` size (44 px touch
  target) is the rule. Compact alternates would dilute the
  "accent earns its place" principle.
- **Resolution**: BRAND WINS. Adapt phase shipped `lg` → 44 px. No
  compact primary variant.

## C-05 — Order status copy uses swiper-side perspective

- **Critique would say**: Nielsen heuristic 2 (Match System / Real
  World) — for an orderer viewing their history, "Open" reads as
  "still waiting for a swiper" but the UI uses the swiper-perspective
  label.
- **Brand says**: Single source of truth for status labels keeps the
  vocabulary consistent across both roles. Both roles see the same
  pills on `/orders` and `/current-orders`.
- **Resolution**: SHARED VOCABULARY WINS. The role badge ("Placed" /
  "Fulfilled") already disambiguates which perspective the user is
  reading. Deferred as P2 in `critique.md`.

---

## Summary

5 brand-vs-critique tensions recorded. Zero overrides applied —
BRAND won every conflict per master plan §Phase 5. The redesign
remains true to the fintech-adjacent, mobile-first, minimal-chrome
voice the brief mandates.

If a future session DOES override one of these (e.g., adds tooltips
because user research demands it), the override should land via a
SCOPE_AMENDMENTS.md entry, not silently mutate this file.
