-- Restores the original profiles_select policy after 20260502000003
-- (untracked, applied directly to remote) broke cross-user profile reads
-- and locked real users out. Reverts to the permissive baseline shipped
-- in 20260427020406_consolidated_schema.sql.

DROP POLICY IF EXISTS "profiles_select" ON "public"."profiles";
DROP POLICY IF EXISTS "profiles_select_self" ON "public"."profiles";
DROP POLICY IF EXISTS "profiles_select_order_counterparty" ON "public"."profiles";

CREATE POLICY "profiles_select" ON "public"."profiles"
  FOR SELECT TO "authenticated" USING (true);
