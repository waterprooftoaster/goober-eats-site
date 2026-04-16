-- Allow option groups to be shared across menu items.
-- Introduces a junction table so multiple items can reference the same
-- option group (e.g., "Size" or "Sauces" appearing on many items).
-- Existing rows are migrated into the junction table before the direct FK
-- on menu_item_option_groups is made nullable.

-- ============================================================
-- Junction table
-- ============================================================

CREATE TABLE "public"."menu_item_option_group_assignments" (
  "menu_item_id"    uuid    NOT NULL,
  "option_group_id" uuid    NOT NULL,
  "sort_order"      integer NOT NULL DEFAULT 0,
  CONSTRAINT "mioga_pkey" PRIMARY KEY ("menu_item_id", "option_group_id"),
  CONSTRAINT "mioga_menu_item_id_fkey"
    FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE CASCADE,
  CONSTRAINT "mioga_option_group_id_fkey"
    FOREIGN KEY ("option_group_id") REFERENCES "public"."menu_item_option_groups"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_mioga_menu_item_id"
  ON "public"."menu_item_option_group_assignments" ("menu_item_id");

ALTER TABLE "public"."menu_item_option_group_assignments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mioga_anon_select"
  ON "public"."menu_item_option_group_assignments" FOR SELECT TO "anon" USING (true);

CREATE POLICY "mioga_auth_select"
  ON "public"."menu_item_option_group_assignments" FOR SELECT TO "authenticated" USING (true);

GRANT ALL ON TABLE "public"."menu_item_option_group_assignments" TO "service_role";
GRANT SELECT ON TABLE "public"."menu_item_option_group_assignments" TO "authenticated";
GRANT SELECT ON TABLE "public"."menu_item_option_group_assignments" TO "anon";

-- ============================================================
-- Migrate existing direct-FK rows into the junction table
-- ============================================================

INSERT INTO "public"."menu_item_option_group_assignments" ("menu_item_id", "option_group_id", "sort_order")
SELECT "menu_item_id", "id", "sort_order"
FROM "public"."menu_item_option_groups"
WHERE "menu_item_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- Decouple option groups from a single item
-- ============================================================

ALTER TABLE "public"."menu_item_option_groups"
  ALTER COLUMN "menu_item_id" DROP NOT NULL;
