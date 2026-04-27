-- Drop the special_instructions column from the orders table.
-- The post-grubhub pivot UI never collected or displayed this field, the
-- createCheckoutSchema rejected it, and the webhook insert is being changed
-- in the same change set to stop writing it. No code path reads it now.

ALTER TABLE "public"."orders"
  DROP COLUMN IF EXISTS "special_instructions";
