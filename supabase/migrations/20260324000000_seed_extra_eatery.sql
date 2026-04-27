-- Add an extra dev eatery for testing the 5-column grid layout.
-- Safe to run on existing data: only inserts if this eatery doesn't already exist.

DO $$
DECLARE
  v_school_id uuid;
BEGIN
  SELECT id INTO v_school_id FROM public.schools WHERE slug = 'nyu';
  IF v_school_id IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.eateries WHERE school_id = v_school_id AND name = 'Levain Bakery'
  ) THEN
    INSERT INTO public.eateries (name, address, image_url, school_id, is_active)
    VALUES (
      'Levain Bakery',
      '167 W 74th St, New York, NY 10023',
      'https://picsum.photos/seed/levain-bakery/640/400',
      v_school_id,
      true
    );
  END IF;
END;
$$;
