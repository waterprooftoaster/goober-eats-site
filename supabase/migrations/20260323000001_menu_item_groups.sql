-- Create menu_item_groups table
CREATE TABLE IF NOT EXISTS menu_item_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eatery_id   uuid NOT NULL REFERENCES eateries(id) ON DELETE CASCADE,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE menu_item_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read groups" ON menu_item_groups
  FOR SELECT TO anon USING (true);

CREATE POLICY "authenticated can read groups" ON menu_item_groups
  FOR SELECT TO authenticated USING (true);

-- service_role bypasses RLS entirely in Supabase — no explicit policy needed

GRANT ALL ON TABLE public.menu_item_groups TO service_role;
GRANT SELECT ON TABLE public.menu_item_groups TO authenticated;
GRANT SELECT ON TABLE public.menu_item_groups TO anon;

CREATE TRIGGER menu_item_groups_set_updated_at
  BEFORE UPDATE ON public.menu_item_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Clear existing menu items before adding the NOT NULL group_id column.
-- The seed script repopulates them with group assignments.
DELETE FROM menu_items;

-- Add group_id to menu_items (NOT NULL — every item must belong to a group)
ALTER TABLE menu_items
  ADD COLUMN group_id uuid NOT NULL REFERENCES menu_item_groups(id) ON DELETE RESTRICT;

CREATE INDEX menu_items_group_id_idx ON public.menu_items (group_id);
CREATE INDEX menu_item_groups_eatery_id_idx ON public.menu_item_groups (eatery_id);

-- RPC: get_menu_for_eatery
-- Returns groups ordered by average discount descending.
-- NULL market_price_cents is treated as 0 discount for the average.
-- Negative discounts (market > original) are clipped to 0.
CREATE OR REPLACE FUNCTION get_menu_for_eatery(eatery_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH group_stats AS (
    SELECT
      g.id,
      g.name,
      ROUND(
        COALESCE(
          AVG(GREATEST(COALESCE(m.original_price_cents - m.market_price_cents, 0), 0)),
          0
        )
      )::int AS avg_discount_cents
    FROM menu_item_groups g
    LEFT JOIN menu_items m ON m.group_id = g.id AND m.is_available = true
    WHERE g.eatery_id = get_menu_for_eatery.eatery_id
    GROUP BY g.id, g.name
  ),
  group_items AS (
    SELECT
      m.group_id,
      jsonb_agg(
        jsonb_build_object(
          'id',                   m.id,
          'name',                 m.name,
          'original_price_cents', m.original_price_cents,
          'market_price_cents',   m.market_price_cents,
          'image_url',            m.image_url,
          'is_available',         m.is_available,
          'created_at',           m.created_at,
          'updated_at',           m.updated_at
        )
        ORDER BY m.name
      ) AS items
    FROM menu_items m
    WHERE m.group_id IN (SELECT id FROM group_stats)
      AND m.is_available = true
    GROUP BY m.group_id
  )
  SELECT jsonb_build_object(
    'groups',
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id',                 gs.id,
          'name',               gs.name,
          'avg_discount_cents', gs.avg_discount_cents,
          'items',              COALESCE(gi.items, '[]'::jsonb)
        )
        ORDER BY gs.avg_discount_cents DESC
      ),
      '[]'::jsonb
    )
  )
  FROM group_stats gs
  LEFT JOIN group_items gi ON gi.group_id = gs.id
$$;

REVOKE ALL ON FUNCTION public.get_menu_for_eatery(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_menu_for_eatery(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_menu_for_eatery(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_menu_for_eatery(uuid) TO anon;
