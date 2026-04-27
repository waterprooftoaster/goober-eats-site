-- ============================================================================
-- Migration: GrubHub-cart-screenshot pivot
--
-- Drops the menu-hosting model (eateries → menu_items → carts) and reshapes
-- `orders` to hold a free-text `restaurant_name` plus 1..5 GrubHub cart-
-- screenshot paths in `cart_screenshot_urls`. Adds `school_id` so swipers
-- only see open orders within their own school.
--
-- Also:
--   - renames the message_type enum value 'delivery_photo' → 'completion_photo'
--   - drops the 'delivery-photos' storage bucket
--   - creates 'completion-photos' (proof-of-fulfillment) and 'cart-screenshots'
--     (orderer GrubHub carts) buckets with appropriate RLS
--
-- Destructive (dev branch); production-data preservation explicitly out of
-- scope. All statements use IF EXISTS / IF NOT EXISTS guards so the migration
-- is re-runnable on partially-migrated databases.
-- ============================================================================

-- ============================================================
-- 1. Drop functions / RPCs that reference doomed tables.
--    Must precede the table drops because plpgsql functions are not
--    automatically recompiled when their referenced tables vanish.
--    `find_nearby_eateries` was already dropped in migration
--    20260412004828, but we re-issue the DROP defensively for partial-
--    apply scenarios.
-- ============================================================
DROP FUNCTION IF EXISTS "public"."seed_dev_eateries"();
DROP FUNCTION IF EXISTS "public"."get_menu_for_eatery"("uuid");
DROP FUNCTION IF EXISTS "public"."find_nearby_eateries"(double precision, double precision, double precision);

-- ============================================================
-- 2. Drop storage RLS policies tied to the soon-to-be-dropped
--    'delivery-photos' bucket.
-- ============================================================
DROP POLICY IF EXISTS "Swipers can upload delivery photos" ON "storage"."objects";
DROP POLICY IF EXISTS "Participants can view delivery photos" ON "storage"."objects";

-- ============================================================
-- 3. Drop orders.eatery_id (FK + index + column) BEFORE dropping eateries.
--    Otherwise the eateries DROP fails with "is referenced by foreign key".
-- ============================================================
DROP INDEX IF EXISTS "public"."orders_eatery_id_idx";
ALTER TABLE "public"."orders" DROP CONSTRAINT IF EXISTS "orders_eatery_id_fkey";
ALTER TABLE "public"."orders" DROP COLUMN IF EXISTS "eatery_id";

-- ============================================================
-- 4. Drop orders.items (jsonb cart-snapshot column) and its CHECK.
-- ============================================================
ALTER TABLE "public"."orders" DROP CONSTRAINT IF EXISTS "orders_items_check";
ALTER TABLE "public"."orders" DROP COLUMN IF EXISTS "items";

-- ============================================================
-- 5. Drop the eatery / menu / cart tables.
--    CASCADE removes internal FKs (cart_items → menu_items, etc.) and any
--    dependent indexes/policies/constraints automatically.
-- ============================================================
DROP TABLE IF EXISTS "public"."cart_items" CASCADE;
DROP TABLE IF EXISTS "public"."carts" CASCADE;
DROP TABLE IF EXISTS "public"."menu_item_option_group_assignments" CASCADE;
DROP TABLE IF EXISTS "public"."menu_item_options" CASCADE;
DROP TABLE IF EXISTS "public"."menu_item_option_groups" CASCADE;
DROP TABLE IF EXISTS "public"."menu_item_groups" CASCADE;
DROP TABLE IF EXISTS "public"."menu_items" CASCADE;
DROP TABLE IF EXISTS "public"."eateries" CASCADE;
DROP TYPE  IF EXISTS "public"."selection_type";

-- ============================================================
-- 6. Reshape orders: relax total CHECK, add the three new columns.
--    Wipe pre-existing rows because they cannot satisfy the new NOT NULLs
--    (no school_id / restaurant_name / cart_screenshot_urls). This is a
--    destructive dev-branch pivot — see migration header.
-- ============================================================
ALTER TABLE "public"."orders" DROP CONSTRAINT IF EXISTS "orders_total_cents_check";
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_total_cents_check"
  CHECK ("total_cents" >= 0);

ALTER TABLE "public"."orders"
  ADD COLUMN IF NOT EXISTS "school_id" "uuid",
  ADD COLUMN IF NOT EXISTS "restaurant_name" "text",
  ADD COLUMN IF NOT EXISTS "cart_screenshot_urls" "text"[];

DELETE FROM "public"."orders";

ALTER TABLE "public"."orders"
  ALTER COLUMN "school_id" SET NOT NULL,
  ALTER COLUMN "restaurant_name" SET NOT NULL,
  ALTER COLUMN "cart_screenshot_urls" SET NOT NULL;

ALTER TABLE "public"."orders" DROP CONSTRAINT IF EXISTS "orders_school_id_fkey";
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE RESTRICT;

ALTER TABLE "public"."orders" DROP CONSTRAINT IF EXISTS "orders_restaurant_name_check";
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_restaurant_name_check"
  CHECK ("char_length"(TRIM(BOTH FROM "restaurant_name")) BETWEEN 1 AND 80);

-- 1..5 elements, no NULL entries. `array_remove(arr, NULL)` deletes NULL
-- members by IS-NOT-DISTINCT-FROM; a length-equality check then rejects any
-- input containing NULLs (which array_length would otherwise count blindly).
ALTER TABLE "public"."orders" DROP CONSTRAINT IF EXISTS "orders_cart_screenshot_urls_check";
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_cart_screenshot_urls_check"
  CHECK (
    array_length("cart_screenshot_urls", 1) BETWEEN 1 AND 5
    AND array_length(array_remove("cart_screenshot_urls", NULL), 1)
        = array_length("cart_screenshot_urls", 1)
  );

-- Partial index for the swiper queue hot path
-- (open + unclaimed orders within a school).
CREATE INDEX IF NOT EXISTS "orders_school_id_open_idx"
  ON "public"."orders" ("school_id")
  WHERE "status" = 'open'::"public"."order_status" AND "swiper_id" IS NULL;

-- Non-partial index for general FK enforcement on school_id (cascades,
-- bulk lookups, RLS branches that check school_id without status).
CREATE INDEX IF NOT EXISTS "orders_school_id_idx"
  ON "public"."orders" ("school_id");

-- GIN index on cart_screenshot_urls so the cart-screenshots storage RLS
-- (`name = ANY (orders.cart_screenshot_urls)`) can probe by element rather
-- than full-scanning orders on every file access.
CREATE INDEX IF NOT EXISTS "orders_cart_screenshot_urls_gin_idx"
  ON "public"."orders" USING GIN ("cart_screenshot_urls");

-- ============================================================
-- 7. Replace orders RLS SELECT policy: scope the open-rows branch by school.
--    Orderer / swiper / anon-orderer branches unchanged.
-- ============================================================
DROP POLICY IF EXISTS "orders_select" ON "public"."orders";
CREATE POLICY "orders_select" ON "public"."orders"
  FOR SELECT TO "authenticated"
  USING (
    (( SELECT auth.uid()) = "orderer_id")
    OR (( SELECT auth.uid()) = "swiper_id")
    OR (( SELECT auth.uid()) = "anon_user_id")
    OR (
      "status" = 'open'::"public"."order_status"
      AND "swiper_id" IS NULL
      AND "school_id" = (
        SELECT p."school_id" FROM "public"."profiles" p
        WHERE p."id" = ( SELECT auth.uid())
      )
    )
  );

-- ============================================================
-- 8. Rename message_type enum value 'delivery_photo' → 'completion_photo'.
--    Atomic: Postgres updates every existing row in-place. Requires PG12+
--    (Supabase is on 15+).
-- ============================================================
ALTER TYPE "public"."message_type" RENAME VALUE 'delivery_photo' TO 'completion_photo';

-- ============================================================
-- 9. Recreate messages CHECK constraint with the renamed enum value.
-- ============================================================
ALTER TABLE "public"."messages" DROP CONSTRAINT IF EXISTS "messages_content_check";
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_content_check" CHECK (
  ("message_type" = 'completion_photo' AND "image_url" IS NOT NULL)
  OR (
    "message_type" IN ('text', 'system')
    AND "body" IS NOT NULL
    AND "char_length"("body") BETWEEN 1 AND 1000
  )
);

-- ============================================================
-- 10. Update set_message_expires_at() trigger fn to the renamed value.
-- ============================================================
CREATE OR REPLACE FUNCTION "public"."set_message_expires_at"()
RETURNS trigger
LANGUAGE plpgsql
SET "search_path" = ''
AS $$
BEGIN
  IF NEW.message_type = 'completion_photo' THEN
    NEW.expires_at := now() + INTERVAL '7 days';
  ELSE
    NEW.expires_at := now() + INTERVAL '48 hours';
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 11. Update cleanup_expired_messages() to point at completion-photos bucket.
-- ============================================================
CREATE OR REPLACE FUNCTION "public"."cleanup_expired_messages"()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" = ''
AS $$
BEGIN
  -- Bypass storage.protect_delete trigger for intentional expiry cleanup.
  SET LOCAL session_replication_role = 'replica';

  -- Remove storage objects for expired completion photos.
  DELETE FROM storage.objects
  WHERE bucket_id = 'completion-photos'
    AND name IN (
      SELECT image_url
      FROM "public"."messages"
      WHERE message_type = 'completion_photo'
        AND expires_at < now()
        AND image_url IS NOT NULL
    );

  -- Delete expired message rows (text/system + completion-photo).
  DELETE FROM "public"."messages"
  WHERE expires_at < now();
END;
$$;

-- ============================================================
-- 12. Storage buckets: drop delivery-photos, create completion-photos
--     and cart-screenshots.
-- ============================================================

-- Drop delivery-photos and its objects (dev branch — no production data).
-- storage.objects and storage.buckets have `protect_delete` triggers that
-- block direct DELETE. Bypassing them requires session_replication_role =
-- 'replica' within a DO block, matching the pattern already used by
-- public.cleanup_expired_messages().
DO $$
BEGIN
  SET LOCAL session_replication_role = 'replica';
  DELETE FROM storage.objects WHERE bucket_id = 'delivery-photos';
  DELETE FROM storage.buckets WHERE id = 'delivery-photos';
END;
$$;

-- completion-photos: replaces delivery-photos. Same limits + MIME whitelist.
-- ON CONFLICT DO UPDATE so re-running the migration self-heals the bucket
-- config if it drifts (rather than silently leaving stale values).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'completion-photos',
  'completion-photos',
  false,
  1048576,
  ARRAY['image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- cart-screenshots: orderer GrubHub cart screenshots, 1..5 per order.
-- 10 MB cap accommodates HEIC originals from iOS; MIME whitelist matches.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cart-screenshots',
  'cart-screenshots',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- 13. completion-photos RLS — mirrors the prior delivery-photos policies.
--     Path convention is unchanged: {order_id}/{filename}.
--     DROP POLICY IF EXISTS guards keep the migration re-runnable.
-- ============================================================
DROP POLICY IF EXISTS "Swipers can upload completion photos" ON storage.objects;
CREATE POLICY "Swipers can upload completion photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'completion-photos'
    AND EXISTS (
      SELECT 1
      FROM "public"."conversations" c
      WHERE c.order_id::text = (storage.foldername(name))[1]
        AND c.swiper_id = ( SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can view completion photos" ON storage.objects;
CREATE POLICY "Participants can view completion photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'completion-photos'
    AND EXISTS (
      SELECT 1
      FROM "public"."conversations" c
      WHERE c.order_id::text = (storage.foldername(name))[1]
        AND ( SELECT auth.uid()) IN (c.orderer_id, c.swiper_id)
    )
  );

-- ============================================================
-- 14. cart-screenshots RLS.
--     INSERT: no policy → only service_role can write directly. All client
--     uploads go through /api/cart-screenshots/upload-url which mints
--     short-lived signed upload URLs (signed-URL writes bypass RLS by design).
--     SELECT: orderer / swiper / anon-orderer of an order whose
--     cart_screenshot_urls contains the object's path. The GIN index on
--     orders.cart_screenshot_urls (created above) supports this lookup.
-- ============================================================
DROP POLICY IF EXISTS "Cart screenshots viewable by order participants" ON storage.objects;
CREATE POLICY "Cart screenshots viewable by order participants"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cart-screenshots'
    AND EXISTS (
      SELECT 1
      FROM "public"."orders" o
      WHERE name = ANY (o."cart_screenshot_urls")
        AND (
          ( SELECT auth.uid()) = o."orderer_id"
          OR ( SELECT auth.uid()) = o."swiper_id"
          OR ( SELECT auth.uid()) = o."anon_user_id"
        )
    )
  );
