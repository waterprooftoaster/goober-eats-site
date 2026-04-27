-- ===========================================================================
-- Rename price_cents → original_price_cents on menu_items
-- ===========================================================================

ALTER TABLE "public"."menu_items" RENAME COLUMN "price_cents" TO "original_price_cents";

ALTER TABLE "public"."menu_items"
  DROP CONSTRAINT "menu_items_price_cents_check";

ALTER TABLE "public"."menu_items"
  ADD CONSTRAINT "menu_items_original_price_cents_check"
  CHECK ("original_price_cents" >= 0);

-- Add market_price_cents (nullable — null means no discount)
ALTER TABLE "public"."menu_items"
  ADD COLUMN "market_price_cents" integer;

ALTER TABLE "public"."menu_items"
  ADD CONSTRAINT "menu_items_market_price_cents_check"
  CHECK ("market_price_cents" IS NULL OR "market_price_cents" >= 0);

-- ===========================================================================
-- selection_type ENUM
-- ===========================================================================

CREATE TYPE "public"."selection_type" AS ENUM ('single', 'multiple');

-- ===========================================================================
-- menu_item_option_groups
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "public"."menu_item_option_groups" (
  "id"             uuid        NOT NULL DEFAULT gen_random_uuid(),
  "menu_item_id"   uuid        NOT NULL,
  "name"           text        NOT NULL,
  "selection_type" "public"."selection_type" NOT NULL DEFAULT 'single',
  "is_required"    boolean     NOT NULL DEFAULT false,
  "sort_order"     integer     NOT NULL DEFAULT 0,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "menu_item_option_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "menu_item_option_groups_menu_item_id_fkey"
    FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE CASCADE
);

CREATE INDEX "menu_item_option_groups_menu_item_id_idx"
  ON "public"."menu_item_option_groups" ("menu_item_id");

CREATE OR REPLACE TRIGGER "menu_item_option_groups_set_updated_at"
  BEFORE UPDATE ON "public"."menu_item_option_groups"
  FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

ALTER TABLE "public"."menu_item_option_groups" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_item_option_groups_anon_select"
  ON "public"."menu_item_option_groups" FOR SELECT TO "anon" USING (true);

CREATE POLICY "menu_item_option_groups_select"
  ON "public"."menu_item_option_groups" FOR SELECT TO "authenticated" USING (true);

GRANT ALL ON TABLE "public"."menu_item_option_groups" TO "service_role";
GRANT SELECT ON TABLE "public"."menu_item_option_groups" TO "authenticated";
GRANT SELECT ON TABLE "public"."menu_item_option_groups" TO "anon";

-- ===========================================================================
-- menu_item_options
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "public"."menu_item_options" (
  "id"                     uuid        NOT NULL DEFAULT gen_random_uuid(),
  "option_group_id"        uuid        NOT NULL,
  "name"                   text        NOT NULL,
  "additional_price_cents" integer     NOT NULL DEFAULT 0,
  "is_default"             boolean     NOT NULL DEFAULT false,
  "sort_order"             integer     NOT NULL DEFAULT 0,
  "created_at"             timestamptz NOT NULL DEFAULT now(),
  "updated_at"             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "menu_item_options_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "menu_item_options_additional_price_cents_check"
    CHECK ("additional_price_cents" >= 0),
  CONSTRAINT "menu_item_options_option_group_id_fkey"
    FOREIGN KEY ("option_group_id") REFERENCES "public"."menu_item_option_groups"("id") ON DELETE CASCADE
);

CREATE INDEX "menu_item_options_option_group_id_idx"
  ON "public"."menu_item_options" ("option_group_id");

CREATE OR REPLACE TRIGGER "menu_item_options_set_updated_at"
  BEFORE UPDATE ON "public"."menu_item_options"
  FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

ALTER TABLE "public"."menu_item_options" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_item_options_anon_select"
  ON "public"."menu_item_options" FOR SELECT TO "anon" USING (true);

CREATE POLICY "menu_item_options_select"
  ON "public"."menu_item_options" FOR SELECT TO "authenticated" USING (true);

GRANT ALL ON TABLE "public"."menu_item_options" TO "service_role";
GRANT SELECT ON TABLE "public"."menu_item_options" TO "authenticated";
GRANT SELECT ON TABLE "public"."menu_item_options" TO "anon";
