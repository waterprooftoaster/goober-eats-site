-- Rename menu_items.restaurant_id → eatery_id and update related objects
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE public.menu_items RENAME COLUMN restaurant_id TO eatery_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'menu_items_restaurant_available_idx') THEN
    ALTER INDEX "menu_items_restaurant_available_idx" RENAME TO "menu_items_eatery_available_idx";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'menu_items_restaurant_id_fkey') THEN
    ALTER TABLE public.menu_items RENAME CONSTRAINT "menu_items_restaurant_id_fkey" TO "menu_items_eatery_id_fkey";
  END IF;
END $$;
