-- Fix messages.sender_id foreign key to reference auth.users instead of profiles.
-- Anonymous users (created by signInAnonymously) have an auth.users row but no
-- profiles row. The previous FK blocked anon users from sending messages via
-- the authenticated message route (POST /api/messages) because sender_id is set
-- to auth.uid() and the profile lookup fails.
--
-- Changing the reference to auth.users allows:
--   - Regular users: sender_id = their profile UUID (also an auth.users UUID)
--   - Anon users:    sender_id = their anon UUID (only in auth.users, no profile)
--   - System/guest:  sender_id = NULL (unchanged, NULL is always allowed)

ALTER TABLE "public"."messages"
  DROP CONSTRAINT IF EXISTS "messages_sender_id_fkey";

ALTER TABLE "public"."messages"
  ADD CONSTRAINT "messages_sender_id_fkey"
  FOREIGN KEY ("sender_id")
  REFERENCES "auth"."users" ("id")
  ON DELETE SET NULL;
