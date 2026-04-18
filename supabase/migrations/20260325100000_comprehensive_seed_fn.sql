-- Replace seed_dev_eateries() with a comprehensive version that seeds
-- 1 school (NYU), 1 eatery (Joe's Pizza), menu groups, menu items,
-- option groups, and options. This ensures the auto-seed on homepage
-- load produces a fully functional dataset sourced entirely from the DB.
--
-- Idempotent: only inserts when the school has zero eateries.

CREATE OR REPLACE FUNCTION public.seed_dev_eateries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id  uuid;
  v_eatery_id  uuid;
  v_group_id   uuid;
  v_item_id    uuid;
  v_opt_grp_id uuid;
BEGIN
  -- 1. School
  INSERT INTO public.schools (name, slug)
  VALUES ('New York University', 'nyu')
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_school_id FROM public.schools WHERE slug = 'nyu';
  IF v_school_id IS NULL THEN RETURN; END IF;

  -- Guard: only seed once
  IF (SELECT COUNT(*) FROM public.eateries WHERE school_id = v_school_id) > 0 THEN
    RETURN;
  END IF;

  -- 2. Eatery
  INSERT INTO public.eateries (name, address, image_url, school_id, is_active)
  VALUES (
    'Joe''s Pizza',
    '7 Carmine St, New York, NY 10014',
    'https://picsum.photos/seed/joes-pizza/1200/500',
    v_school_id,
    true
  )
  RETURNING id INTO v_eatery_id;

  -- 3. Menu item groups
  -- Pizzas
  INSERT INTO public.menu_item_groups (eatery_id, name)
  VALUES (v_eatery_id, 'Pizzas')
  RETURNING id INTO v_group_id;

  -- Margherita Pizza
  INSERT INTO public.menu_items (eatery_id, group_id, name, original_price_cents, market_price_cents, image_url, is_available)
  VALUES (v_eatery_id, v_group_id, 'Margherita Pizza', 1200, 1000, 'https://picsum.photos/seed/margherita/400/400', true)
  RETURNING id INTO v_item_id;

  INSERT INTO public.menu_item_option_groups (menu_item_id, name, selection_type, is_required, sort_order)
  VALUES (v_item_id, 'Size', 'single', true, 0)
  RETURNING id INTO v_opt_grp_id;

  INSERT INTO public.menu_item_options (option_group_id, name, additional_price_cents, is_default, sort_order) VALUES
    (v_opt_grp_id, 'Small',  0,   true,  0),
    (v_opt_grp_id, 'Medium', 200, false, 1),
    (v_opt_grp_id, 'Large',  400, false, 2);

  INSERT INTO public.menu_item_option_groups (menu_item_id, name, selection_type, is_required, sort_order)
  VALUES (v_item_id, 'Toppings', 'multiple', false, 1)
  RETURNING id INTO v_opt_grp_id;

  INSERT INTO public.menu_item_options (option_group_id, name, additional_price_cents, is_default, sort_order) VALUES
    (v_opt_grp_id, 'Extra Cheese', 150, false, 0),
    (v_opt_grp_id, 'Fresh Basil',  50,  false, 1),
    (v_opt_grp_id, 'Chili Flakes', 0,   false, 2);

  -- Pepperoni Pizza
  INSERT INTO public.menu_items (eatery_id, group_id, name, original_price_cents, market_price_cents, image_url, is_available)
  VALUES (v_eatery_id, v_group_id, 'Pepperoni Pizza', 1400, NULL, 'https://picsum.photos/seed/pepperoni/400/400', true)
  RETURNING id INTO v_item_id;

  INSERT INTO public.menu_item_option_groups (menu_item_id, name, selection_type, is_required, sort_order)
  VALUES (v_item_id, 'Size', 'single', true, 0)
  RETURNING id INTO v_opt_grp_id;

  INSERT INTO public.menu_item_options (option_group_id, name, additional_price_cents, is_default, sort_order) VALUES
    (v_opt_grp_id, 'Small',  0,   true,  0),
    (v_opt_grp_id, 'Medium', 200, false, 1),
    (v_opt_grp_id, 'Large',  400, false, 2);

  -- Sides
  INSERT INTO public.menu_item_groups (eatery_id, name)
  VALUES (v_eatery_id, 'Sides')
  RETURNING id INTO v_group_id;

  -- Caesar Salad
  INSERT INTO public.menu_items (eatery_id, group_id, name, original_price_cents, market_price_cents, image_url, is_available)
  VALUES (v_eatery_id, v_group_id, 'Caesar Salad', 800, 650, 'https://picsum.photos/seed/caesar-salad/400/400', true);

  -- Garlic Bread
  INSERT INTO public.menu_items (eatery_id, group_id, name, original_price_cents, market_price_cents, image_url, is_available)
  VALUES (v_eatery_id, v_group_id, 'Garlic Bread', 400, NULL, 'https://picsum.photos/seed/garlic-bread/400/400', true);

  -- Desserts
  INSERT INTO public.menu_item_groups (eatery_id, name)
  VALUES (v_eatery_id, 'Desserts')
  RETURNING id INTO v_group_id;

  -- Tiramisu
  INSERT INTO public.menu_items (eatery_id, group_id, name, original_price_cents, market_price_cents, image_url, is_available)
  VALUES (v_eatery_id, v_group_id, 'Tiramisu', 700, 550, 'https://picsum.photos/seed/tiramisu/400/400', true);

END;
$$;

-- Keep existing grants
GRANT EXECUTE ON FUNCTION public.seed_dev_eateries() TO anon;
GRANT EXECUTE ON FUNCTION public.seed_dev_eateries() TO authenticated;
