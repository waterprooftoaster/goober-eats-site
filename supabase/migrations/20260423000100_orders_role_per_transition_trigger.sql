-- ============================================================================
-- Migration: Role-per-transition enforcement on orders.status
--
-- Finding #10: orders_update RLS permits any orderer/swiper to set any
-- status. App-layer status/route.ts already enforces role-per-transition,
-- but DB-level defense-in-depth was missing.
--
-- Postgres RLS WITH CHECK cannot reference OLD.status, so full per-
-- transition enforcement requires a BEFORE UPDATE trigger. This migration
-- installs one:
--
--   Transition          Allowed role
--   ---------------     --------------------
--   open → cancelled    orderer (auth.uid = OLD.orderer_id)
--   open → in_progress  service_role only (accept flow is atomic claim)
--   in_progress → open  service_role only (un-accept clears swiper_id)
--   in_progress →
--     completed         swiper (auth.uid = OLD.swiper_id)
--
-- Service role (Supabase clients created via SUPABASE_SECRET_KEY) bypasses
-- the matrix entirely; the atomic accept, un-accept, and webhook-driven
-- transitions all route through service_role intentionally.
-- ============================================================================

-- ============================================================
-- 1. Trigger function.
--
--    Service-role bypass comes first — this preserves the service-client
--    paths in app/api/orders/[id]/status/route.ts (un-accept, completion
--    when service client is used for the transfer) and the accept-flow's
--    atomic claim.
--
--    `auth.jwt() IS NULL` covers direct Postgres connections (migration
--    apply, psql, seed scripts) so the trigger doesn't break those.
--
--    `SET search_path = ''` is the Supabase hardening convention for
--    function bodies (blocks search-path attacks via public function
--    shadowing).
-- ============================================================
CREATE OR REPLACE FUNCTION "public"."enforce_order_role_transition"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET "search_path" = ''
AS $$
DECLARE
    jwt_role text;
    actor_uid uuid;
    pg_role text;
BEGIN
    -- Direct Postgres connections (migrations, psql, seed scripts) run as
    -- `postgres` or `supabase_admin`. Bypass the matrix for those so
    -- migrations and maintenance scripts are not blocked. We intentionally
    -- do NOT use `auth.jwt() IS NULL` as the bypass — that would also
    -- allow anon PostgREST requests if a future policy opens UPDATE to
    -- anon (defense in depth).
    pg_role := current_user;
    IF pg_role = 'postgres' OR pg_role = 'supabase_admin' THEN
        RETURN NEW;
    END IF;

    jwt_role := COALESCE("auth"."jwt"() ->> 'role', '');

    -- Service role (SUPABASE_SECRET_KEY clients): bypass. All atomic claims
    -- + webhook writes + un-accept flows take this path.
    IF jwt_role = 'service_role' THEN
        RETURN NEW;
    END IF;

    actor_uid := "auth"."uid"();

    -- Status unchanged: trigger fires on UPDATE OF status but UPDATE OF may
    -- still run when the column is re-assigned to the same value.
    IF OLD."status" IS NOT DISTINCT FROM NEW."status" THEN
        RETURN NEW;
    END IF;

    -- Role-per-transition matrix. Any un-matched transition raises.
    IF OLD."status" = 'open' AND NEW."status" = 'cancelled' THEN
        IF actor_uid IS DISTINCT FROM OLD."orderer_id" THEN
            RAISE EXCEPTION 'only the orderer can cancel an open order';
        END IF;
    ELSIF OLD."status" = 'open' AND NEW."status" = 'in_progress' THEN
        RAISE EXCEPTION 'accept must go through the service client';
    ELSIF OLD."status" = 'in_progress' AND NEW."status" = 'completed' THEN
        IF actor_uid IS DISTINCT FROM OLD."swiper_id" THEN
            RAISE EXCEPTION 'only the swiper can complete an order';
        END IF;
    ELSIF OLD."status" = 'in_progress' AND NEW."status" = 'open' THEN
        RAISE EXCEPTION 'un-accept must go through the service client';
    ELSE
        RAISE EXCEPTION 'invalid status transition: % -> %', OLD."status", NEW."status";
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."enforce_order_role_transition"() OWNER TO "postgres";

-- ============================================================
-- 2. Install the trigger. BEFORE UPDATE OF status narrows firing; the WHEN
--    clause short-circuits when the status column is included in SET but
--    unchanged (belt-and-braces with the function's no-op check).
-- ============================================================
DROP TRIGGER IF EXISTS "enforce_order_role_transition" ON "public"."orders";

CREATE TRIGGER "enforce_order_role_transition"
    BEFORE UPDATE OF "status" ON "public"."orders"
    FOR EACH ROW
    WHEN (OLD."status" IS DISTINCT FROM NEW."status")
    EXECUTE FUNCTION "public"."enforce_order_role_transition"();
