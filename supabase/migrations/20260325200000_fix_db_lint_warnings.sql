-- Fix Supabase database linter warnings:
--   1. auth_rls_initplan: wrap auth.uid() in (select auth.uid())
--   2. multiple_permissive_policies: consolidate into single policies
--   3. function_search_path_mutable: add SET search_path = ''

-- ===========================================================================
-- 1a. conversations — wrap auth.uid()
-- ===========================================================================

DROP POLICY "Users can view their conversations" ON "public"."conversations";
CREATE POLICY "Users can view their conversations"
  ON "public"."conversations" FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IN ("orderer_id", "swiper_id"));

DROP POLICY "Swiper can create conversation on accept" ON "public"."conversations";
CREATE POLICY "Swiper can create conversation on accept"
  ON "public"."conversations" FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = "swiper_id");

-- ===========================================================================
-- 1b. messages — wrap auth.uid()
-- ===========================================================================

DROP POLICY "Participants can view messages" ON "public"."messages";
CREATE POLICY "Participants can view messages"
  ON "public"."messages" FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "public"."conversations" c
      WHERE c.id = "conversation_id"
        AND (select auth.uid()) IN (c."orderer_id", c."swiper_id")
    )
  );

DROP POLICY "Participants can send messages" ON "public"."messages";
CREATE POLICY "Participants can send messages"
  ON "public"."messages" FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = "sender_id"
    AND EXISTS (
      SELECT 1 FROM "public"."conversations" c
      WHERE c.id = "conversation_id"
        AND (select auth.uid()) IN (c."orderer_id", c."swiper_id")
    )
  );

DROP POLICY "Participants can mark messages read" ON "public"."messages";
CREATE POLICY "Participants can mark messages read"
  ON "public"."messages" FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "public"."conversations" c
      WHERE c.id = "conversation_id"
        AND (select auth.uid()) IN (c."orderer_id", c."swiper_id")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."conversations" c
      WHERE c.id = "conversation_id"
        AND (select auth.uid()) IN (c."orderer_id", c."swiper_id")
    )
  );

-- ===========================================================================
-- 1c. carts — wrap auth.uid()
-- ===========================================================================

DROP POLICY "carts_select" ON "public"."carts";
CREATE POLICY "carts_select" ON "public"."carts"
  FOR SELECT TO "authenticated" USING ("user_id" = (select auth.uid()));

DROP POLICY "carts_insert" ON "public"."carts";
CREATE POLICY "carts_insert" ON "public"."carts"
  FOR INSERT TO "authenticated" WITH CHECK ("user_id" = (select auth.uid()));

DROP POLICY "carts_update" ON "public"."carts";
CREATE POLICY "carts_update" ON "public"."carts"
  FOR UPDATE TO "authenticated" USING ("user_id" = (select auth.uid()));

DROP POLICY "carts_delete" ON "public"."carts";
CREATE POLICY "carts_delete" ON "public"."carts"
  FOR DELETE TO "authenticated" USING ("user_id" = (select auth.uid()));

-- ===========================================================================
-- 1d. cart_items — wrap auth.uid()
-- ===========================================================================

DROP POLICY "cart_items_select" ON "public"."cart_items";
CREATE POLICY "cart_items_select" ON "public"."cart_items"
  FOR SELECT TO "authenticated"
  USING ("cart_id" IN (SELECT "id" FROM "public"."carts" WHERE "user_id" = (select auth.uid())));

DROP POLICY "cart_items_insert" ON "public"."cart_items";
CREATE POLICY "cart_items_insert" ON "public"."cart_items"
  FOR INSERT TO "authenticated"
  WITH CHECK ("cart_id" IN (SELECT "id" FROM "public"."carts" WHERE "user_id" = (select auth.uid())));

DROP POLICY "cart_items_delete" ON "public"."cart_items";
CREATE POLICY "cart_items_delete" ON "public"."cart_items"
  FOR DELETE TO "authenticated"
  USING ("cart_id" IN (SELECT "id" FROM "public"."carts" WHERE "user_id" = (select auth.uid())));

-- ===========================================================================
-- 2a. orders SELECT — consolidate 3 policies into 1
-- ===========================================================================

DROP POLICY "orders_orderer_select" ON "public"."orders";
DROP POLICY "orders_swiper_select" ON "public"."orders";
DROP POLICY "orders_pending_select" ON "public"."orders";

CREATE POLICY "orders_select" ON "public"."orders"
  FOR SELECT TO "authenticated"
  USING (
    (select auth.uid()) = "orderer_id"
    OR (select auth.uid()) = "swiper_id"
    OR ("status" = 'pending'::"public"."order_status" AND "swiper_id" IS NULL)
  );

-- ===========================================================================
-- 2b. orders UPDATE — consolidate 2 policies into 1
-- ===========================================================================

DROP POLICY "orders_orderer_update" ON "public"."orders";
DROP POLICY "orders_swiper_update" ON "public"."orders";

CREATE POLICY "orders_update" ON "public"."orders"
  FOR UPDATE TO "authenticated"
  USING (
    (select auth.uid()) = "orderer_id"
    OR (select auth.uid()) = "swiper_id"
  )
  WITH CHECK (
    ((select auth.uid()) = "orderer_id" AND "swiper_id" IS DISTINCT FROM (select auth.uid()))
    OR (select auth.uid()) = "swiper_id"
  );

-- ===========================================================================
-- 2c. payments SELECT — consolidate 2 policies into 1
-- ===========================================================================

DROP POLICY "payments_payer_select" ON "public"."payments";
DROP POLICY "payments_payee_select" ON "public"."payments";

CREATE POLICY "payments_select" ON "public"."payments"
  FOR SELECT TO "authenticated"
  USING (
    (select auth.uid()) = "payer_id"
    OR (select auth.uid()) = "payee_id"
  );

-- ===========================================================================
-- 3. Functions — add SET search_path = ''
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.check_email_exists(lookup_email text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = lower(lookup_email));
$$;

CREATE OR REPLACE FUNCTION "public"."set_message_expires_at"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.message_type = 'delivery_photo' THEN
    NEW.expires_at := now() + INTERVAL '7 days';
  ELSE
    NEW.expires_at := now() + INTERVAL '48 hours';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."cleanup_expired_messages"()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Bypass the storage protect_delete trigger for intentional expiry cleanup
  SET LOCAL session_replication_role = 'replica';

  -- Remove storage objects for expired delivery photos
  DELETE FROM storage.objects
  WHERE bucket_id = 'delivery-photos'
    AND name IN (
      SELECT image_url
      FROM "public"."messages"
      WHERE message_type = 'delivery_photo'
        AND expires_at < now()
        AND image_url IS NOT NULL
    );

  -- Delete expired message rows
  DELETE FROM "public"."messages"
  WHERE expires_at < now();
END;
$$;
