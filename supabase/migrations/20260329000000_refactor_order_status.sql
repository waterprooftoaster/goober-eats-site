-- Refactor order_status enum:
--   pending  → open       (clearer name for unclaimed orders)
--   accepted → in_progress (merge: accepted is now immediately in_progress)
--   paid     → removed    (payment is required before orders enter the system)
--
-- New valid transitions:
--   open        → in_progress (swiper accepts)
--   open        → cancelled   (orderer cancels)
--   in_progress → completed   (swiper completes)
--   in_progress → open        (swiper un-accepts)
--   completed   → (terminal)
--   cancelled   → (terminal)

-- Step 1: Drop the partial index that references the old enum type in its WHERE clause
DROP INDEX IF EXISTS "public"."orders_status_idx";

-- Step 2: Drop all RLS policies that may reference the status column
DROP POLICY IF EXISTS "orders_select" ON "public"."orders";
DROP POLICY IF EXISTS "orders_update" ON "public"."orders";
DROP POLICY IF EXISTS "orders_insert" ON "public"."orders";
DROP POLICY IF EXISTS "orders_orderer_select" ON "public"."orders";
DROP POLICY IF EXISTS "orders_swiper_select" ON "public"."orders";
DROP POLICY IF EXISTS "orders_pending_select" ON "public"."orders";
DROP POLICY IF EXISTS "orders_open_select" ON "public"."orders";
DROP POLICY IF EXISTS "orders_orderer_update" ON "public"."orders";
DROP POLICY IF EXISTS "orders_swiper_update" ON "public"."orders";

-- Step 3: Drop column default (references old enum type)
ALTER TABLE "public"."orders" ALTER COLUMN "status" DROP DEFAULT;

-- Step 4: Convert column to text to decouple from old enum
ALTER TABLE "public"."orders"
    ALTER COLUMN "status" TYPE text
    USING "status"::text;

-- Step 5: Remap old status values
UPDATE "public"."orders" SET "status" = 'open'        WHERE "status" = 'pending';
UPDATE "public"."orders" SET "status" = 'in_progress' WHERE "status" = 'accepted';
UPDATE "public"."orders" SET "status" = 'completed'   WHERE "status" = 'paid';

-- Step 6: Drop old enum
DROP TYPE IF EXISTS "public"."order_status";

-- Step 7: Create new enum
CREATE TYPE "public"."order_status" AS ENUM (
    'open',
    'in_progress',
    'completed',
    'cancelled'
);
ALTER TYPE "public"."order_status" OWNER TO "postgres";

-- Step 8: Convert column back to new enum type
ALTER TABLE "public"."orders"
    ALTER COLUMN "status" TYPE "public"."order_status"
    USING "status"::"public"."order_status";

-- Step 9: Restore column default
ALTER TABLE "public"."orders"
    ALTER COLUMN "status" SET DEFAULT 'open'::"public"."order_status";

-- Step 10: Rebuild partial index with new type
CREATE INDEX "orders_status_idx" ON "public"."orders" USING "btree" ("status")
    WHERE ("status" = 'open'::"public"."order_status");

-- Step 11: Recreate RLS policies
CREATE POLICY "orders_select" ON "public"."orders"
    FOR SELECT TO "authenticated"
    USING (
        (( SELECT "auth"."uid"() AS "uid") = "orderer_id")
        OR
        (( SELECT "auth"."uid"() AS "uid") = "swiper_id")
        OR
        (("status" = 'open'::"public"."order_status") AND ("swiper_id" IS NULL))
    );

CREATE POLICY "orders_insert" ON "public"."orders"
    FOR INSERT TO "authenticated"
    WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "orderer_id"));

CREATE POLICY "orders_update" ON "public"."orders"
    FOR UPDATE TO "authenticated"
    USING ((( SELECT "auth"."uid"() AS "uid") = "orderer_id") OR (( SELECT "auth"."uid"() AS "uid") = "swiper_id"))
    WITH CHECK (
        ((( SELECT "auth"."uid"() AS "uid") = "orderer_id") AND ("swiper_id" IS DISTINCT FROM ( SELECT "auth"."uid"() AS "uid")))
        OR
        (( SELECT "auth"."uid"() AS "uid") = "swiper_id")
    );
