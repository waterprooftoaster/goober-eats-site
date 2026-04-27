-- Drop function that uses the location column
DROP FUNCTION IF EXISTS public.find_nearby_eateries(double precision, double precision, double precision);

-- Revoke read_at update permission before dropping column
REVOKE UPDATE (read_at) ON public.messages FROM authenticated;

-- Drop spatial index (must precede dropping the location column)
DROP INDEX IF EXISTS eateries_location_gist_idx;

-- Eateries: drop PostGIS location columns and unused label
ALTER TABLE public.eateries
  DROP COLUMN IF EXISTS location,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS delivery_time_label;

-- Profiles: drop dead columns
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS avatar_url;

-- Messages: drop read_at
ALTER TABLE public.messages
  DROP COLUMN IF EXISTS read_at;
