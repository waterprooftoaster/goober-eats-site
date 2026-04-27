# Phase 5.2 — `harden` (edge cases + 3 S07 chat MEDIUMs)

> Cross-page edge-case + production-readiness sweep across the catalog's 13
> routes. Folds in the three S07 cumulative-code-review MEDIUMs that target
> chat-surface edge cases (StrictMode race, dismissed-panel re-open,
> sendMessage `res.json()` catch).

## Method

Static page-file + colocated-client-component scan against the harden
skill's checklist (long-text overflow, empty states, error/loading
boundaries, network failures, concurrent-submit prevention,
keyboard a11y, semantic HTML). Reference master plan §10
safe-optimistic-UI table for per-action failure modes.

## Findings + fixes

### Catalog-wide audit results

| Surface | Long-text overflow | Empty state | Error boundary | Concurrent submit | Keyboard a11y | Verdict |
|---|---|---|---|---|---|---|
| `/` (home) | n/a (no list) | n/a | global `app/error.tsx` | `isUploading` gate at `app/page.tsx:144` | dropzone has cursor-pointer + native input fallback | GREEN |
| `/checkout` | n/a | redirect to `/` if no screenshots | colocated `app/checkout/error.tsx` | `isSubmitting` gates all inputs + button (`app/checkout/page.tsx:294,308,322,340`) | form fields use `<label htmlFor>` + `<Input id>` | GREEN |
| `/checkout/return` | n/a | n/a (server-only) | colocated `app/checkout/return/error.tsx` | n/a | n/a | GREEN |
| `/orders` | `truncate font-medium` on restaurant + `min-w-0` flex (`app/orders/page.tsx:88-91`) | `Surface` empty state with testid (lines 70-81) | global | n/a (read-only) | n/a (read-only) | GREEN |
| `/current-orders` | `truncate text-sm font-semibold` + `min-w-0` (`app/current-orders/current-orders-list.tsx:64-67`) | `Surface` empty state with testid (lines 40-54) | colocated `app/current-orders/error.tsx` | n/a (chat-input handles its own gating) | n/a | GREEN |
| `/auth/login` | n/a | n/a (form) | global | login-form uses `disabled` gating per step | form fields labeled | GREEN (S05) |
| `/order/[orderId]` | n/a | n/a (always navigates away) | global | n/a | n/a | GREEN |
| `/account` | n/a | (modal) | global | account-actions gates submit | Modal primitive (Radix Dialog) handles focus trap | GREEN (S06) |
| `/swiper-registration` | n/a | n/a (multi-step form) | global | form gates submit | combobox uses `role="combobox"` (Base UI) | GREEN (S06) |
| `/swiper/orders` | `truncate text-sm font-medium` on order-card (was a real gap — fix below) | `swiper-orders-empty-state` testid (`pending-orders-list.tsx:127-133`) | colocated `app/swiper/orders/error.tsx` | `accepting` ref + `disabled={accepting}` (`pending-orders-list.tsx:51,178`) | **FIX APPLIED** — see OrderCard below | GREEN after fix |
| `/stripe/onboard/complete` | n/a | n/a (success page) | colocated `app/stripe/onboard/complete/error.tsx` | n/a | n/a | GREEN (S06) |
| `/stripe/onboard/refresh` | n/a | n/a | global | n/a | n/a | GREEN (S06) |
| Shell layout | n/a | n/a | global | n/a | header has aria-labels, ChatPanel uses Sheet (vaul) with focus trap | GREEN (S07) |

### Real fixes applied

#### 1. `components/order/order-card.tsx` — keyboard a11y + brand color tokens

The clickable card was a `<div onClick>` with `cursor-pointer`. Three real
issues:

1. **No keyboard activation.** A non-interactive `<div>` with an `onClick`
   handler is invisible to keyboard navigation (no `Tab` focus, no `Enter`
   activation). WCAG 2.1.1.
2. **Raw `gray-*` palette.** Lines 37, 40, 51 used `bg-gray-50` /
   `border-gray-200` / `text-gray-400` — the Tailwind defaults. Per
   `.impeccable.md` brand principle 5: surfaces are tinted neutral, not
   pure gray. The OKLCH 126 palette has dedicated `secondary` /
   `border` / `muted-foreground` tokens for exactly this purpose.
3. **No focus-visible ring.** Even if it were a button, no visual focus
   indicator means keyboard users can't see where they are.

**Fix** (single commit, no API change):
- `<div onClick>` → `<button type="button" onClick>` (semantic, focusable,
  keyboard-activatable).
- `hover:bg-gray-50` → `hover:bg-secondary/60` (brand-aligned, matches
  the `outline` button variant's hover state).
- `bg-gray-50` (thumbnail bg) → `bg-muted/40` (tinted surface).
- `border-gray-200` → `border-border` (tinted neutral).
- `text-gray-400` → `text-muted-foreground` (warm, not pure gray).
- Added `focus-visible:ring-2 focus-visible:ring-ring/40` and
  `motion-reduce:transition-none` for the colour transition.
- Added `tabular-nums` on the dollar amount so totals don't dance as digits
  change (consistent with the orders history page).

The existing 6 OrderCard unit tests (`tests/unit/components/order/order-card.test.tsx`)
still pass — the testid `order-card` is preserved on the new `<button>`.
Same E2E selectors keep working.

### S07 cumulative code-review MEDIUMs (interleaved)

#### MEDIUM 1: `useMessages` StrictMode race — FIXED with TDD

**Location**: `hooks/use-messages.ts` — Effect 2 (subscription setup,
lines 117-156) vs Effect 3 (initial fetch, lines 159-205).

**Bug**: `initialFetchDoneRef` and `bufferRef` were reset at the TOP of
Effect 2. Their lifetime was tied to the SUBSCRIPTION lifecycle, but
they fundamentally gate the FETCH lifecycle. When Effect 3 re-ran without
Effect 2 re-running (e.g. `orderId` changes while `resolvedConvId` stays
stable via the providedConvId path that chat-panel-provider's B2 JOIN
takes), `initialFetchDoneRef.current` stayed `true` from the previous
fetch. A realtime INSERT arriving during the new fetch was MERGED
DIRECTLY into the about-to-be-replaced state instead of buffered, then
overwritten by the new fetch's response. Message lost.

**Fix**: Move both ref resets from Effect 2's body (top) to Effect 3's
cleanup (bottom). Cleanup runs on every Effect 3 re-run AND on unmount,
so the buffering window starts clean for every new fetch. The bufferRef
also clears so stale entries from a prior conversation can't leak into
a new one.

**TDD discipline**: Added a regression spec (`tests/unit/hooks/use-messages.test.ts`,
"preserves a realtime INSERT delivered during a stable-conversationId
orderId change") that exercises the exact race scenario. Watched it
FAIL against the original code (`expected [ 'msg-b1' ] to include 'msg-late'`
— `msg-late` was lost). Applied the fix. Watched it PASS. All other 19
use-messages specs continue to pass (20/20 total).

#### MEDIUM 2: chat-panel-provider dismissed-panel re-open — FIXED with TDD

**Location**: `components/chat-panel/chat-panel-provider.tsx` —
`loadActiveOrders` (lines 110-139) calls `openPanel` for every active
order on every refetch (mount, visibility refetch).

**Bug**: When the user dismissed a panel via `closePanel`, the orderId
was removed from React state but no record was kept of the dismissal.
On the next visibility refetch, `loadActiveOrders` queried the same
order again and called `openPanel`, which re-created the entry.
Dismissed panels would silently re-appear when the tab returned to
foreground. UX regression on long-lived sessions.

**Fix**: Add `dismissedOrderIdsRef = useRef<Set<string>>(new Set())`
in the provider. `closePanel` records the orderId in the set BEFORE
removing from state (so a racing `loadActiveOrders` can't beat us to
re-open). `openPanel` short-circuits on dismissed orderIds.

The dismissed-set is intentionally session-scoped (a useRef): a
dismissed panel stays dismissed until the user navigates or reloads.
Reload re-evaluates from the `loadActiveOrders` query.

**TDD discipline**: Added a regression spec
(`tests/unit/components/chat-panel/chat-panel-provider.test.tsx`,
"does not re-open a user-dismissed panel on visibility-refetch
loadActiveOrders") that mounts the provider, captures auto-open,
dismisses, simulates a `visibilitychange→visible` event, and asserts
the panel does NOT reappear. Watched it FAIL against the original
code (the dismissed panel re-appeared with full state). Applied the
fix. Watched it PASS. All other 6 chat-panel-provider specs continue
to pass (7/7 total).

#### MEDIUM 3: `sendMessage` `res.json()` catch — INTENTIONALLY NOT FIXED

**Location**: `hooks/use-messages.ts:225-238`. The error-path branch
on line 227 already has `.catch(() => ({}))` — the pre-existing guard
for malformed error JSON. The 201 success-path on line 232 does NOT
have a catch.

**Analysis**: If `/api/messages` returns 201 with an invalid JSON body,
`await res.json()` throws. The throw propagates UP through `sendMessage`'s
caller (`chat-view.tsx`'s `handleSend`) which catches it and calls
`markFailed(temp_id)`. The user sees the optimistic message in the
"Failed" state with a Retry button. **This is the architecturally-correct
behaviour** for a server contract violation.

Defense-in-depth scenario: even if the user retries (creating a duplicate
server-side INSERT), the `temp_id` echoes through the API per the S07
A07-01 amendment, and `mergeMessages` dedupes by `temp_id`. No duplicate
visible to the user.

Self-healing scenario: even without a retry, when the realtime INSERT
echo eventually arrives via the channel-registry subscription, it carries
the canonical row + the same `temp_id`. `mergeMessages` REPLACES the
"Failed" optimistic with the canonical row. The state heals.

A defensive `.catch()` would either (a) silently swallow the error and
leave the user thinking the message sent (bad — they'd send again
manually), or (b) explicitly log and rethrow (no behaviour change vs
status quo, just adds a log line).

**Decision**: No fix. The architecturally-correct path is the existing
behaviour. The Explore-phase trace agreed; the cumulative S07
code-reviewer flagged it as "belt-and-suspenders" only. Recorded here
for traceability; not deferred to a future session — actively decided to
leave alone.

## Master plan §10 cross-check

Reviewed each row of the safe-optimistic-UI table against current code:

| Action | Plan rule | Current implementation | Verdict |
|---|---|---|---|
| Send message (text) | Optimistic; reconcile via temp_id | `appendOptimistic` + `markFailed` + temp_id round-trip | GREEN (S07) |
| Accept order (swiper) | Soft-disable, NOT optimistic | `pending-orders-list.tsx:51,178` `accepting` flag + soft-disable; on 409 remove + toast | GREEN (S06) |
| Un-accept | Spinner; reconcile via realtime | `completion-banner.tsx` button gating + realtime status update | GREEN (S07) |
| Cancel (orderer, from open) | Optimistic with rollback | Not implemented in current UI (no orderer-cancel surface) | DEFERRED (out of S08 scope; would be a new feature) |
| Complete (swiper) | NOT optimistic; gate on completion_photo | `completion-banner.tsx` button enabled only when photo persisted | GREEN (S06+S07) |
| Profile toggle `is_swiper=false` | Confirm dialog, server-driven | `account-actions.tsx` confirm + server response | GREEN (S06) |
| Screenshot upload | Optimistic preview; retry on error | `app/page.tsx` blob preview + error retry path | GREEN (S04) |
| Completion photo upload | Partial optimistic; never flip status | `chat-input.tsx` upload spinner; status flips via realtime | GREEN (S07) |

## Files changed (in this commit)

```
MODIFIED
  hooks/use-messages.ts                                       (Effect 2/3 ref-reset relocation)
  components/chat-panel/chat-panel-provider.tsx               (dismissedOrderIdsRef)
  components/order/order-card.tsx                             (semantic button + brand tokens + focus ring + tabular-nums)
  tests/unit/hooks/use-messages.test.ts                       (+1 race regression spec)
  tests/unit/components/chat-panel/chat-panel-provider.test.tsx (+1 dismissed-set regression spec)

NEW
  docs/redesign/05-cross-page/harden.md                       (this report)
```

## Frozen-surface invariants

`git diff 738e8e7 -- <§9 frozen paths>` adds zero lines on top of the
S07 A07-01 baseline. All edits are in the editable surface
(components/, hooks/, tests/unit/, docs/redesign/).
