-- Rename profiles.username → full_name
ALTER TABLE public.profiles RENAME COLUMN username TO full_name;

-- Drop unique index (full names aren't unique)
DROP INDEX IF EXISTS profiles_username_unique_idx;

-- Replace CHECK constraint: 1-100 chars (was 1-50)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_full_name_check
  CHECK (char_length(TRIM(BOTH FROM full_name)) >= 1
    AND char_length(TRIM(BOTH FROM full_name)) <= 100);

-- Function to check if email exists in auth.users (sign-in vs sign-up detection).
-- SECURITY DEFINER so it can read auth.users; only service_role may call it.
CREATE OR REPLACE FUNCTION public.check_email_exists(lookup_email text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = lower(lookup_email));
$$;

REVOKE EXECUTE ON FUNCTION public.check_email_exists FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_email_exists TO service_role;
