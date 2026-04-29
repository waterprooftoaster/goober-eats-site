-- @file 20260429000001_add_transfer_failed_at.sql
-- @description Add nullable transfer_failed_at column to payments. When the
--   Stripe Transfer API rejects a transfer on order completion, lib/stripe/transfer.ts
--   sets this timestamp instead of silently swallowing the failure. The order
--   itself stays in 'completed' (Stripe holds the platform balance); ops queries
--   this column to find stuck transfers.

ALTER TABLE "public"."payments"
  ADD COLUMN IF NOT EXISTS "transfer_failed_at" timestamptz;

COMMENT ON COLUMN "public"."payments"."transfer_failed_at" IS
  'Set by lib/stripe/transfer.ts when stripe.transfers.create rejects on order completion; null on success.';
