-- Add guest_access_token to orders for passwordless guest chat access.
-- Guests receive a secure UUID token after checkout; it is stored in an
-- httpOnly cookie and validated server-side by the guest API endpoints.

ALTER TABLE "public"."orders"
  ADD COLUMN IF NOT EXISTS "guest_access_token" uuid;

-- Partial unique index: only non-null values are indexed, avoiding conflicts
-- across the many NULL rows for authenticated user orders.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_orders_guest_access_token"
  ON "public"."orders" ("guest_access_token")
  WHERE "guest_access_token" IS NOT NULL;
