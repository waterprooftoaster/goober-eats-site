-- @file 20260429000002_add_stripe_accounts_suspended.sql
-- @description Add suspended column to stripe_accounts. Set true by
--   app/api/stripe/webhooks/route.ts when account.updated arrives with
--   requirements.disabled_reason starting with 'rejected.' (Stripe has
--   permanently terminated the connected account). Read by
--   lib/api/helpers.ts:getAuthenticatedUser, app/auth/actions.ts:authenticate,
--   and lib/auth/resolve-principal.ts to force-logout / block sign-in.

ALTER TABLE "public"."stripe_accounts"
  ADD COLUMN IF NOT EXISTS "suspended" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "public"."stripe_accounts"."suspended" IS
  'True after Stripe permanently terminates this connected account (account.updated with requirements.disabled_reason starting "rejected."). Triggers force-logout and sign-in blocking at the application layer.';
