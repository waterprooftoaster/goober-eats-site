-- Treat partially-completed signups (no OTP confirmation yet) as if they
-- never happened. Without this, the auth.users row left behind by
-- supabase.auth.signUp() blocks the user from retrying signup AND makes the
-- email-existence probe (used by the login form) report "Welcome back" for
-- an account the user can never actually sign into.

-- Replace check_email_exists so unconfirmed signups don't count as
-- "existing". /api/auth/check-email's only consumer is the sign-in vs
-- sign-up split, so filtering out NULL email_confirmed_at rows is the right
-- definition for that boundary.
CREATE OR REPLACE FUNCTION public.check_email_exists(lookup_email text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO ''
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM auth.users
      WHERE email = lower(lookup_email)
        AND email_confirmed_at IS NOT NULL
    );
  $$;

-- Wipe any unconfirmed auth.users row for an email so a retry of the signup
-- flow starts from a clean slate. Mirrors delete_user_account: SECURITY
-- DEFINER so it can reach into auth.users, callable only by service_role
-- (signUpStart runs server-side and uses the service client).
CREATE OR REPLACE FUNCTION public.delete_unconfirmed_user(target_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM auth.users
  WHERE email = lower(target_email)
    AND email_confirmed_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_unconfirmed_user(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_unconfirmed_user(text) TO service_role;
