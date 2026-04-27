-- ===========================================================================
-- carts table
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "public"."carts" (
  "id"          uuid        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     uuid,
  "session_id"  text,
  "eatery_id"   uuid        NOT NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "carts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "carts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  CONSTRAINT "carts_eatery_id_fkey"
    FOREIGN KEY ("eatery_id") REFERENCES "public"."eateries"("id") ON DELETE CASCADE,
  CONSTRAINT "carts_user_or_session" CHECK (
    ("user_id" IS NOT NULL AND "session_id" IS NULL) OR
    ("user_id" IS NULL AND "session_id" IS NOT NULL)
  ),
  CONSTRAINT "carts_user_id_unique"    UNIQUE ("user_id"),
  CONSTRAINT "carts_session_id_unique" UNIQUE ("session_id")
);

CREATE OR REPLACE TRIGGER "carts_set_updated_at"
  BEFORE UPDATE ON "public"."carts"
  FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE INDEX "carts_user_id_idx"
  ON "public"."carts" ("user_id") WHERE "user_id" IS NOT NULL;

CREATE INDEX "carts_session_id_idx"
  ON "public"."carts" ("session_id") WHERE "session_id" IS NOT NULL;

ALTER TABLE "public"."carts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carts_select" ON "public"."carts"
  FOR SELECT TO "authenticated" USING ("user_id" = auth.uid());

CREATE POLICY "carts_insert" ON "public"."carts"
  FOR INSERT TO "authenticated" WITH CHECK ("user_id" = auth.uid());

CREATE POLICY "carts_update" ON "public"."carts"
  FOR UPDATE TO "authenticated" USING ("user_id" = auth.uid());

CREATE POLICY "carts_delete" ON "public"."carts"
  FOR DELETE TO "authenticated" USING ("user_id" = auth.uid());

GRANT ALL ON TABLE "public"."carts" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."carts" TO "authenticated";

-- ===========================================================================
-- cart_items table
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "public"."cart_items" (
  "id"               uuid        NOT NULL DEFAULT gen_random_uuid(),
  "cart_id"          uuid        NOT NULL,
  "menu_item_id"     uuid        NOT NULL,
  "quantity"         integer     NOT NULL DEFAULT 1,
  "selected_options" jsonb       NOT NULL DEFAULT '[]'::jsonb,
  "added_at"         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cart_items_cart_id_fkey"
    FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE CASCADE,
  CONSTRAINT "cart_items_menu_item_id_fkey"
    FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE CASCADE,
  CONSTRAINT "cart_items_quantity_positive" CHECK ("quantity" > 0)
);

CREATE INDEX "cart_items_cart_id_idx"
  ON "public"."cart_items" ("cart_id");

ALTER TABLE "public"."cart_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cart_items_select" ON "public"."cart_items"
  FOR SELECT TO "authenticated"
  USING ("cart_id" IN (SELECT "id" FROM "public"."carts" WHERE "user_id" = auth.uid()));

CREATE POLICY "cart_items_insert" ON "public"."cart_items"
  FOR INSERT TO "authenticated"
  WITH CHECK ("cart_id" IN (SELECT "id" FROM "public"."carts" WHERE "user_id" = auth.uid()));

CREATE POLICY "cart_items_delete" ON "public"."cart_items"
  FOR DELETE TO "authenticated"
  USING ("cart_id" IN (SELECT "id" FROM "public"."carts" WHERE "user_id" = auth.uid()));

GRANT ALL ON TABLE "public"."cart_items" TO "service_role";
GRANT SELECT, INSERT, DELETE ON TABLE "public"."cart_items" TO "authenticated";
