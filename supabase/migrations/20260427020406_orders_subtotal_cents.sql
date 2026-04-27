-- Add orders.subtotal_cents — the GrubHub subtotal the orderer enters at
-- checkout. The 60/50/10 policy split (orderer pays 60% / swiper 50% /
-- platform 10%) is derived from this column by lib/pricing.ts:computeSplit.
--
-- Backfill: pre-policy rows had no discount applied; total_cents was both the
-- charge and the implicit subtotal. Setting subtotal = total preserves the
-- historical record without claiming a discount that never happened.

ALTER TABLE "public"."orders"
  ADD COLUMN "subtotal_cents" integer;

UPDATE "public"."orders"
  SET "subtotal_cents" = "total_cents"
  WHERE "subtotal_cents" IS NULL;

ALTER TABLE "public"."orders"
  ALTER COLUMN "subtotal_cents" SET NOT NULL,
  ADD CONSTRAINT "orders_subtotal_cents_check" CHECK ("subtotal_cents" >= 0);
