-- Drop the tip_cents column and its CHECK constraint from the orders table.
-- Tips were retired as a feature in the post-grubhub pivot; the column has
-- been written as 0 since the checkout-session schema stopped accepting it,
-- and no UI surface reads it. The webhook insert and the Order TS type drop
-- the field in the same change set, so the schema and the code agree.

ALTER TABLE "public"."orders"
  DROP CONSTRAINT IF EXISTS "orders_tip_cents_check";

ALTER TABLE "public"."orders"
  DROP COLUMN IF EXISTS "tip_cents";
