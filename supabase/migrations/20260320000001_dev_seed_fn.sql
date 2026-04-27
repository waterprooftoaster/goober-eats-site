-- Dev-only seed function using SECURITY DEFINER to bypass RLS.
-- Called via supabase.rpc('seed_dev_eateries') from server components.
-- Idempotent: only inserts if eateries table is empty for NYU school.

CREATE OR REPLACE FUNCTION public.seed_dev_eateries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  INSERT INTO public.schools (name, slug)
  VALUES ('New York University', 'nyu')
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_school_id FROM public.schools WHERE slug = 'nyu';

  IF v_school_id IS NULL THEN RETURN; END IF;

  IF (SELECT COUNT(*) FROM public.eateries WHERE school_id = v_school_id) > 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.eateries (name, address, image_url, school_id, is_active)
  VALUES
    ('Joe''s Pizza',       '7 Carmine St, New York, NY 10014',    'https://picsum.photos/seed/joes-pizza/640/400',       v_school_id, true),
    ('Sushi Palace',       '100 W 4th St, New York, NY 10012',    'https://picsum.photos/seed/sushi-palace/640/400',     v_school_id, true),
    ('Burger Barn',        '55 W 8th St, New York, NY 10011',     'https://picsum.photos/seed/burger-barn/640/400',      v_school_id, true),
    ('Taco Fiesta',        '200 Mercer St, New York, NY 10012',   'https://picsum.photos/seed/taco-fiesta/640/400',      v_school_id, true),
    ('Noodle House',       '30 W 8th St, New York, NY 10011',     'https://picsum.photos/seed/noodle-house/640/400',     v_school_id, true),
    ('The Halal Guys',     '307 W 53rd St, New York, NY 10019',   'https://picsum.photos/seed/halal-guys/640/400',       v_school_id, true),
    ('Insomnia Cookies',   '115 MacDougal St, New York, NY 10012','https://picsum.photos/seed/insomnia-cookies/640/400', v_school_id, true),
    ('Boba Guys',          '11 Waverly Pl, New York, NY 10003',   'https://picsum.photos/seed/boba-guys/640/400',        v_school_id, true),
    ('Mamoun''s Falafel',  '119 MacDougal St, New York, NY 10012','https://picsum.photos/seed/mamouns-falafel/640/400',  v_school_id, true),
    ('NYU Palladium Dining','140 E 14th St, New York, NY 10003',  'https://picsum.photos/seed/nyu-palladium/640/400',    v_school_id, true);
END;
$$;

-- Allow the anon and authenticated roles to call this function
GRANT EXECUTE ON FUNCTION public.seed_dev_eateries() TO anon;
GRANT EXECUTE ON FUNCTION public.seed_dev_eateries() TO authenticated;
