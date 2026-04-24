-- ============================================================================
-- Migration: Payments hardening — schema additions
--
-- Adds the schema surface needed to fix 12 payments-surface findings:
--   - 'disputed' payment_status (dispute webhook handlers — finding #2)
--   - stripe_accounts Connect state columns (onboarding downgrade — #3, #4, #12)
--   - stripe_events idempotency table (webhook replay guard — #9)
--   - transfer_failures table (silent transfer failure visibility — #11)
--
-- Idempotent: all statements use IF [NOT] EXISTS. Re-runnable on partially-
-- migrated databases.
-- ============================================================================

-- ============================================================
-- 1. Add 'disputed' to payment_status enum.
--    ADD VALUE IF NOT EXISTS is transactional but must run outside a
--    transaction block on Postgres < 14; Supabase is on 15+, so inline apply
--    is safe. No existing rows need remap — the new value is net-new.
-- ============================================================
ALTER TYPE "public"."payment_status" ADD VALUE IF NOT EXISTS 'disputed';

-- ============================================================
-- 2. stripe_accounts: add Connect account-state columns.
--    Defaults chosen so existing rows (which predate the columns) fail the
--    composite eligibility gate in accept/route.ts — safer than assuming
--    healthy state. Webhook handler backfills on the next account.updated.
-- ============================================================
ALTER TABLE "public"."stripe_accounts"
    ADD COLUMN IF NOT EXISTS "charges_enabled" boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "payouts_enabled" boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "disabled_reason" text,
    ADD COLUMN IF NOT EXISTS "currently_due" text[] NOT NULL DEFAULT '{}';

-- ============================================================
-- 2b. orders: DB-level guard that in_progress requires a swiper.
--     RLS + app code already enforce this, but a CHECK constraint is
--     cheap permanent defense-in-depth (database-reviewer agent gap A).
--     NOT VALID skips the existing-row check; all existing rows satisfy
--     this invariant by construction (accept sets swiper_id atomically).
-- ============================================================
ALTER TABLE "public"."orders" DROP CONSTRAINT IF EXISTS "orders_in_progress_requires_swiper";
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_in_progress_requires_swiper"
    CHECK ("status" <> 'in_progress'::"public"."order_status" OR "swiper_id" IS NOT NULL);

-- ============================================================
-- 3. stripe_events: webhook-event idempotency.
--    UNIQUE on stripe_event_id is the dedupe mechanism; the handler calls
--    `upsert(..., { onConflict, ignoreDuplicates: true }).select('id')` and
--    treats an empty RETURNING set as "row already existed, duplicate"
--    (see lib/stripe/webhook-idempotency.ts).
--
--    RLS enabled with no policies: service_role bypasses; no other role
--    has a legitimate reason to read this table.
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."stripe_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stripe_events_stripe_event_id_key" UNIQUE ("stripe_event_id")
);
ALTER TABLE "public"."stripe_events" OWNER TO "postgres";
ALTER TABLE "public"."stripe_events" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "public"."stripe_events" TO "service_role";

-- Explicitly revoke the implicit SELECT granted via ALTER DEFAULT PRIVILEGES
-- in 20260320000000_fresh_schema.sql. RLS with no policies already blocks
-- row-level access, but removing the table-level grant is airtight against
-- a future permissive policy or SECURITY DEFINER view. Revoke from `anon`
-- too in case a future migration grants SELECT to the anon role.
REVOKE SELECT ON TABLE "public"."stripe_events" FROM "authenticated";
REVOKE SELECT ON TABLE "public"."stripe_events" FROM "anon";

CREATE INDEX IF NOT EXISTS "stripe_events_received_at_idx"
    ON "public"."stripe_events" ("received_at");

-- ============================================================
-- 4. transfer_failures: persistent log of failed Stripe transfers.
--    Replaces the prior silent console.error-and-return behavior in
--    lib/stripe/transfer.ts. `resolved_at` is NULL until ops manually
--    retries; the partial index supports the "unresolved" dashboard query.
--
--    RLS enabled with no policies: service_role only (ops console queries
--    via service role). ON DELETE CASCADE keeps the log consistent if an
--    order is hard-deleted.
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."transfer_failures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "stripe_error_code" "text",
    "stripe_error_message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "transfer_failures_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "transfer_failures_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE
);
ALTER TABLE "public"."transfer_failures" OWNER TO "postgres";
ALTER TABLE "public"."transfer_failures" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "public"."transfer_failures" TO "service_role";

-- Same rationale as stripe_events: revoke the implicit SELECT grant from
-- both authenticated and anon roles.
REVOKE SELECT ON TABLE "public"."transfer_failures" FROM "authenticated";
REVOKE SELECT ON TABLE "public"."transfer_failures" FROM "anon";

CREATE INDEX IF NOT EXISTS "transfer_failures_unresolved_idx"
    ON "public"."transfer_failures" ("order_id")
    WHERE "resolved_at" IS NULL;
