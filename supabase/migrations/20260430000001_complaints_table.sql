-- @file 20260430000001_complaints_table.sql
-- @description Adds the order-complaint feature. An authenticated orderer can
--   file one complaint per completed order within a 24-hour window. The AI
--   adjudicator (lib/ai/complaint-adjudicator.ts) writes the verdict back via
--   the service client; an `approve_refund` verdict triggers a Stripe refund
--   in the API layer (lib/stripe/refund.ts).
--
--   Pieces:
--   1. orders.completed_at timestamp set in PATCH /api/orders/[id]/status when
--      status transitions to 'completed' (read by the eligibility trigger and
--      by the UI's 24-hour gate).
--   2. complaint_verdict and complaint_category enums.
--   3. complaints table — one row per order (UNIQUE (order_id)).
--   4. BEFORE INSERT trigger that enforces: order is completed, completed_at
--      within 24h, and the complainant matches the order's orderer_id.
--   5. RLS policies that scope insert/select to the orderer; the service
--      client bypasses RLS for verdict updates.

-- 1. completed_at on orders
ALTER TABLE "public"."orders"
  ADD COLUMN IF NOT EXISTS "completed_at" timestamptz;

CREATE INDEX IF NOT EXISTS "orders_completed_at_idx"
  ON "public"."orders" ("completed_at")
  WHERE "completed_at" IS NOT NULL;

COMMENT ON COLUMN "public"."orders"."completed_at" IS
  'Set by app/api/orders/[id]/status when status transitions to completed. Drives the 24-hour complaint eligibility window.';

-- 2. Enums
DO $$ BEGIN
  CREATE TYPE "public"."complaint_verdict" AS ENUM ('pending','approve_refund','deny','escalate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."complaint_category" AS ENUM ('wrong_items','missing_items','never_delivered','damaged','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "public"."complaint_verdict" OWNER TO "postgres";
ALTER TYPE "public"."complaint_category" OWNER TO "postgres";

-- 3. complaints table
CREATE TABLE IF NOT EXISTS "public"."complaints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid NOT NULL,
  "complainant_id" uuid NOT NULL,
  "category" "public"."complaint_category" NOT NULL,
  "reason_text" text NOT NULL,
  "verdict" "public"."complaint_verdict" NOT NULL DEFAULT 'pending',
  "ai_reasoning" jsonb,
  "ai_confidence" numeric(3,2),
  "refund_amount_cents" integer,
  "stripe_refund_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "resolved_at" timestamptz,
  CONSTRAINT "complaints_one_per_order" UNIQUE ("order_id"),
  CONSTRAINT "complaints_reason_text_check"
    CHECK (char_length(btrim("reason_text")) BETWEEN 20 AND 1000),
  CONSTRAINT "complaints_ai_confidence_check"
    CHECK ("ai_confidence" IS NULL OR ("ai_confidence" >= 0 AND "ai_confidence" <= 1)),
  CONSTRAINT "complaints_refund_amount_check"
    CHECK ("refund_amount_cents" IS NULL OR "refund_amount_cents" >= 0),
  CONSTRAINT "complaints_stripe_refund_id_unique" UNIQUE ("stripe_refund_id")
);

ALTER TABLE "public"."complaints" OWNER TO "postgres";

ALTER TABLE ONLY "public"."complaints"
  ADD CONSTRAINT "complaints_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."complaints"
  ADD CONSTRAINT "complaints_complainant_id_fkey"
  FOREIGN KEY ("complainant_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS "complaints_order_id_idx"
  ON "public"."complaints" ("order_id");

CREATE INDEX IF NOT EXISTS "complaints_created_at_idx"
  ON "public"."complaints" ("created_at");

GRANT ALL ON TABLE "public"."complaints" TO "anon";
GRANT ALL ON TABLE "public"."complaints" TO "authenticated";
GRANT ALL ON TABLE "public"."complaints" TO "service_role";

-- 4. Eligibility trigger (defense-in-depth on top of the API check)
CREATE OR REPLACE FUNCTION "public"."check_complaint_eligibility"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = NEW.order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order % does not exist', NEW.order_id;
  END IF;
  IF o.status <> 'completed'::public.order_status THEN
    RAISE EXCEPTION 'order % is not completed', NEW.order_id;
  END IF;
  IF o.completed_at IS NULL OR (now() - o.completed_at) > interval '24 hours' THEN
    RAISE EXCEPTION 'complaint window for order % has expired', NEW.order_id;
  END IF;
  IF o.orderer_id IS NULL OR o.orderer_id <> NEW.complainant_id THEN
    RAISE EXCEPTION 'only the orderer may file a complaint';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."check_complaint_eligibility"() OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."check_complaint_eligibility"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_complaint_eligibility"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_complaint_eligibility"() TO "service_role";

DROP TRIGGER IF EXISTS "complaints_eligibility_check" ON "public"."complaints";
CREATE TRIGGER "complaints_eligibility_check"
  BEFORE INSERT ON "public"."complaints"
  FOR EACH ROW EXECUTE FUNCTION "public"."check_complaint_eligibility"();

-- 5. RLS
ALTER TABLE "public"."complaints" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "complaints_insert" ON "public"."complaints";
CREATE POLICY "complaints_insert" ON "public"."complaints"
  FOR INSERT TO "authenticated"
  WITH CHECK ((SELECT auth.uid()) = "complainant_id");

DROP POLICY IF EXISTS "complaints_select" ON "public"."complaints";
CREATE POLICY "complaints_select" ON "public"."complaints"
  FOR SELECT TO "authenticated"
  USING ((SELECT auth.uid()) = "complainant_id");

COMMENT ON TABLE "public"."complaints" IS
  'One complaint per completed order. Verdict updates (approve_refund / deny / escalate) are written via the service client by app/api/orders/[id]/complaints/route.ts after the AI adjudicator returns. RLS allows orderer-scoped insert/select only.';
