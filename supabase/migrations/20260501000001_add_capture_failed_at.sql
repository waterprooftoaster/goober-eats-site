-- @file 20260501000001_add_capture_failed_at.sql
-- @description Add nullable capture_failed_at column to payments. Under the
--   manual-capture flow, lib/stripe/capture-and-transfer.ts attempts
--   paymentIntents.capture when a swiper completes an order. If capture
--   fails (auth expired, card declined, bank pulled), the function sets
--   this timestamp; the completion API responds 409 and the order stays
--   in 'in_progress' for ops follow-up. Mirrors the shape of
--   payments.transfer_failed_at (20260429000001).
--
-- Rollback:
--   ALTER TABLE "public"."payments" DROP COLUMN IF EXISTS "capture_failed_at";

ALTER TABLE "public"."payments"
  ADD COLUMN IF NOT EXISTS "capture_failed_at" timestamptz;

COMMENT ON COLUMN "public"."payments"."capture_failed_at" IS
  'Set by lib/stripe/capture-and-transfer.ts when stripe.paymentIntents.capture rejects at order completion; null on success.';
