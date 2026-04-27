# Scope Amendments

> Append-only log of deliberate, scoped exceptions to the master plan. Each
> amendment is recorded BEFORE the work that consumes it lands; the
> consuming commit references the amendment by ID.
>
> An amendment is **not** a license to broadly relax the master plan. Each
> entry is bounded — files, lines, and reason — and future sessions return
> to the unamended invariant.

---

## A07-01 — `messages.temp_id` end-to-end (Session 07)

- **Date:** 2026-04-25
- **Session:** 07 (Global shell + realtime audit)
- **Master-plan section amended:** §9 (frozen write surface)
- **Consuming commits:** `phase4/messages-temp-id` (commit 0b), `phase4/use-messages-migration` (commit 4), `phase4/chat-input-optimistic` (commit 6)

### What is allowed (one shot)

The frozen-surface diff sentinel will see the following additive edits in
commit 0b only. Every other S07 commit must keep the sentinel green for
all other paths.

| Path | Change shape | Justification |
|---|---|---|
| `supabase/migrations/<timestamp>_messages_temp_id.sql` (NEW) | Adds `messages.temp_id text` (nullable). No RLS change. No table-shape change beyond the new column. | Catalog `GLOBAL-CHAT-INPUT-ACTIVE` has stated `temp_id`-based optimistic append since S01; column does not exist yet. |
| `lib/types/database.ts` | Regenerated from the migrated schema. Additive only — `temp_id: string \| null` appears on `messages` table types. | Type-source consistency. |
| `lib/types/messaging.ts` | `Message.temp_id?: string \| null` added. Existing fields unchanged. | Frontend type parity with the column. |
| `lib/types/api.ts` | `CreateMessageRequest.temp_id?: string` added (Zod schema gains `.optional()` field). | API request envelope must accept the optimistic id. |
| `app/api/messages/route.ts` | Reads `temp_id` from validated request body; passes it into the insert; returns it in the response payload. No other behavior change. | Server must echo the client-supplied id so the dedupe-by-temp_id works on the realtime INSERT echo. |
| `app/api/guest/messages/route.ts` | Same additive change as `/api/messages/route.ts`. | Guest path must support optimistic UI symmetrically. |

### What is still off-limits

- Every other path in master plan §9.
- Every other `app/api/**` route.
- Every other migration.
- Stripe paths, `lib/orders/state-machine.ts`, `lib/api/{guest-auth,helpers}.ts`, `lib/supabase/**` (other than the type regen above), `scripts/**`.

### Why a permanent code change is the right call

1. **Catalog alignment.** `00-features.md` (SHA-locked at `e6be0f5…`) has
   advertised this UX since S01: *"Optimistic append with temp_id;
   reconcile via realtime or POST response."* The catalog is the
   contract; either we ship the consumer or we delete the catalog row.
   Deleting the row is a worse outcome than amending §9 once.

2. **Speculative-abstraction rule** (`.claude/rules/common/coding-style.md`):
   shipping the dedupe in `use-messages` without a real consumer would
   add tested-but-unused code — exactly the anti-pattern that rule
   forbids.

3. **Backward-compatibility.** Every change is additive and nullable.
   Existing clients that do not send `temp_id` continue to work
   unchanged. No migration of existing message rows. No RLS rewrite.
   Future-proof for the next session's static fail.

4. **Bounded blast radius.** Six files, all additive. The migration
   adds a single nullable column. No row-level touches. Rollback is
   trivial (`ALTER TABLE messages DROP COLUMN temp_id`).

### Verification at commit 0b

The frozen-path sentinel runs after commit 0b with this expected diff:

```
supabase/migrations/<timestamp>_messages_temp_id.sql  # 100% new file
lib/types/database.ts                                 # only the messages table block changes
lib/types/messaging.ts                                # +1 line in Message interface
lib/types/api.ts                                      # +1 line in CreateMessageRequest schema
app/api/messages/route.ts                             # +2 lines in insert + response
app/api/guest/messages/route.ts                       # +2 lines in insert + response
```

Any line outside this set in those files, or any change to any other
frozen path, fails the sentinel and aborts the commit.

### Future sessions

Sessions 08+ return to the unamended §9 invariant. This amendment is
scoped to the six file changes above. No transitive permission to
revisit `app/api/**` for unrelated reasons.
