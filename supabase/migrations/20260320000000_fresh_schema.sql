
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

SET default_tablespace = '';

SET default_table_access_method = "heap";

-- ===========================================================================
-- Functions
-- ===========================================================================

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;
ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;
ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

-- ===========================================================================
-- Schools
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "public"."schools" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."schools" OWNER TO "postgres";

ALTER TABLE ONLY "public"."schools"
    ADD CONSTRAINT "schools_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."schools"
    ADD CONSTRAINT "schools_slug_key" UNIQUE ("slug");

CREATE OR REPLACE TRIGGER "schools_set_updated_at" BEFORE UPDATE ON "public"."schools" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

ALTER TABLE "public"."schools" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schools_anon_select" ON "public"."schools" FOR SELECT TO "anon" USING (true);
CREATE POLICY "schools_select" ON "public"."schools" FOR SELECT TO "authenticated" USING (true);

GRANT ALL ON TABLE "public"."schools" TO "service_role";
GRANT SELECT ON TABLE "public"."schools" TO "authenticated";
GRANT SELECT ON TABLE "public"."schools" TO "anon";

-- ===========================================================================
-- Profiles
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "email" "text" NOT NULL,
    "school_id" "uuid",
    "avatar_url" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_username_check" CHECK ((("char_length"(TRIM(BOTH FROM "username")) >= 1) AND ("char_length"(TRIM(BOTH FROM "username")) <= 50)))
);
ALTER TABLE "public"."profiles" OWNER TO "postgres";

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX "profiles_username_unique_idx" ON "public"."profiles" (lower("username"));

CREATE INDEX "profiles_school_id_idx" ON "public"."profiles" USING "btree" ("school_id");

CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE SET NULL;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_insert" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));
CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));

GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."profiles" TO "authenticated";

-- ===========================================================================
-- Eateries
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "public"."eateries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "image_url" "text",
    "address" "text" NOT NULL,
    "delivery_time_label" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "latitude" double precision,
    "longitude" double precision,
    "location" "extensions"."geography"(Point,4326) GENERATED ALWAYS AS (
CASE
    WHEN (("latitude" IS NOT NULL) AND ("longitude" IS NOT NULL)) THEN ("extensions"."st_makepoint"("longitude", "latitude"))::"extensions"."geography"
    ELSE NULL::"extensions"."geography"
END) STORED,
    CONSTRAINT "eateries_latitude_check" CHECK ((("latitude" >= ('-90'::integer)::double precision) AND ("latitude" <= (90)::double precision))),
    CONSTRAINT "eateries_longitude_check" CHECK ((("longitude" >= ('-180'::integer)::double precision) AND ("longitude" <= (180)::double precision)))
);
ALTER TABLE "public"."eateries" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."find_nearby_eateries"("user_lat" double precision, "user_lng" double precision, "radius_km" double precision) RETURNS SETOF "public"."eateries"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$begin
  if radius_km <= 0 or radius_km > 50 then
    raise exception 'radius_km must be between 0 and 50, got %', radius_km;
  end if;

  return query
    select *
    from public.eateries
    where is_active = true
      and location is not null
      and st_dwithin(
            location,
            st_makepoint(user_lng, user_lat)::geography,
            radius_km * 1000
          )
    order by
      location <-> st_makepoint(user_lng, user_lat)::geography;
end;$$;
ALTER FUNCTION "public"."find_nearby_eateries"("user_lat" double precision, "user_lng" double precision, "radius_km" double precision) OWNER TO "postgres";

ALTER TABLE ONLY "public"."eateries"
    ADD CONSTRAINT "eateries_pkey" PRIMARY KEY ("id");

CREATE INDEX "eateries_location_gist_idx" ON "public"."eateries" USING "gist" ("location") WHERE ("is_active" = true);
CREATE INDEX "eateries_school_active_idx" ON "public"."eateries" USING "btree" ("school_id") WHERE ("is_active" = true);

CREATE OR REPLACE TRIGGER "eateries_set_updated_at" BEFORE UPDATE ON "public"."eateries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

ALTER TABLE ONLY "public"."eateries"
    ADD CONSTRAINT "eateries_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE CASCADE;

ALTER TABLE "public"."eateries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eateries_anon_select" ON "public"."eateries" FOR SELECT TO "anon" USING (("is_active" = true));
CREATE POLICY "eateries_select" ON "public"."eateries" FOR SELECT TO "authenticated" USING (("is_active" = true));

GRANT ALL ON TABLE "public"."eateries" TO "service_role";
GRANT SELECT ON TABLE "public"."eateries" TO "authenticated";
GRANT SELECT ON TABLE "public"."eateries" TO "anon";

-- ===========================================================================
-- Menu Items
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "eatery_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price_cents" integer NOT NULL,
    "image_url" "text",
    "is_available" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "menu_items_price_cents_check" CHECK (("price_cents" >= 0))
);
ALTER TABLE "public"."menu_items" OWNER TO "postgres";

ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");

CREATE INDEX "menu_items_eatery_available_idx" ON "public"."menu_items" USING "btree" ("eatery_id") WHERE ("is_available" = true);

CREATE OR REPLACE TRIGGER "menu_items_set_updated_at" BEFORE UPDATE ON "public"."menu_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_eatery_id_fkey" FOREIGN KEY ("eatery_id") REFERENCES "public"."eateries"("id") ON DELETE CASCADE;

ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_items_anon_select" ON "public"."menu_items" FOR SELECT TO "anon" USING (("is_available" = true));
CREATE POLICY "menu_items_select" ON "public"."menu_items" FOR SELECT TO "authenticated" USING (("is_available" = true));

GRANT ALL ON TABLE "public"."menu_items" TO "service_role";
GRANT SELECT ON TABLE "public"."menu_items" TO "authenticated";
GRANT SELECT ON TABLE "public"."menu_items" TO "anon";

-- ===========================================================================
-- Enums
-- ===========================================================================

CREATE TYPE "public"."order_status" AS ENUM (
    'pending',
    'accepted',
    'in_progress',
    'completed',
    'paid',
    'cancelled'
);
ALTER TYPE "public"."order_status" OWNER TO "postgres";

CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'succeeded',
    'failed',
    'refunded'
);
ALTER TYPE "public"."payment_status" OWNER TO "postgres";

-- ===========================================================================
-- Orders
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orderer_id" "uuid",
    "swiper_id" "uuid",
    "eatery_id" "uuid" NOT NULL,
    "status" "public"."order_status" DEFAULT 'pending' NOT NULL,
    "items" "jsonb" NOT NULL,
    "total_cents" integer NOT NULL,
    "tip_cents" integer DEFAULT 0 NOT NULL,
    "special_instructions" "text",
    "guest_name" "text",
    "guest_phone" "text",
    "guest_stripe_pm_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "orders_items_check" CHECK (("jsonb_array_length"("items") > 0)),
    CONSTRAINT "orders_total_cents_check" CHECK (("total_cents" > 0)),
    CONSTRAINT "orders_tip_cents_check" CHECK (("tip_cents" >= 0)),
    CONSTRAINT "orders_orderer_or_guest" CHECK (
        ("orderer_id" IS NOT NULL)
        OR
        ("guest_name" IS NOT NULL AND "guest_phone" IS NOT NULL AND "guest_stripe_pm_id" IS NOT NULL)
    )
);
ALTER TABLE "public"."orders" OWNER TO "postgres";

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");

CREATE INDEX "orders_orderer_id_idx" ON "public"."orders" USING "btree" ("orderer_id");
CREATE INDEX "orders_swiper_id_idx" ON "public"."orders" USING "btree" ("swiper_id") WHERE ("swiper_id" IS NOT NULL);
CREATE INDEX "orders_status_idx" ON "public"."orders" USING "btree" ("status") WHERE ("status" = 'pending'::"public"."order_status");
CREATE INDEX "orders_eatery_id_idx" ON "public"."orders" USING "btree" ("eatery_id");

CREATE OR REPLACE TRIGGER "orders_set_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_orderer_id_fkey" FOREIGN KEY ("orderer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_swiper_id_fkey" FOREIGN KEY ("swiper_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_eatery_id_fkey" FOREIGN KEY ("eatery_id") REFERENCES "public"."eateries"("id") ON DELETE CASCADE;

ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_orderer_select" ON "public"."orders" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "orderer_id"));
CREATE POLICY "orders_swiper_select" ON "public"."orders" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "swiper_id"));
CREATE POLICY "orders_pending_select" ON "public"."orders" FOR SELECT TO "authenticated" USING ((("status" = 'pending'::"public"."order_status") AND ("swiper_id" IS NULL)));
CREATE POLICY "orders_insert" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "orderer_id"));
CREATE POLICY "orders_orderer_update" ON "public"."orders" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "orderer_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "orderer_id") AND ("swiper_id" IS DISTINCT FROM ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "orders_swiper_update" ON "public"."orders" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "swiper_id"));

GRANT ALL ON TABLE "public"."orders" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."orders" TO "authenticated";

-- ===========================================================================
-- Payments
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "stripe_payment_intent_id" "text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "platform_fee_cents" integer DEFAULT 0 NOT NULL,
    "status" "public"."payment_status" DEFAULT 'pending' NOT NULL,
    "payer_id" "uuid",
    "payee_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payments_amount_cents_check" CHECK (("amount_cents" > 0)),
    CONSTRAINT "payments_platform_fee_cents_check" CHECK (("platform_fee_cents" >= 0))
);
ALTER TABLE "public"."payments" OWNER TO "postgres";

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_key" UNIQUE ("order_id");

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_stripe_payment_intent_id_key" UNIQUE ("stripe_payment_intent_id");

CREATE INDEX "payments_order_id_idx" ON "public"."payments" USING "btree" ("order_id");
CREATE INDEX "payments_payer_id_idx" ON "public"."payments" USING "btree" ("payer_id");
CREATE INDEX "payments_payee_id_idx" ON "public"."payments" USING "btree" ("payee_id");

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_payee_id_fkey" FOREIGN KEY ("payee_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_payer_select" ON "public"."payments" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "payer_id"));
CREATE POLICY "payments_payee_select" ON "public"."payments" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "payee_id"));

GRANT ALL ON TABLE "public"."payments" TO "service_role";
GRANT SELECT ON TABLE "public"."payments" TO "authenticated";

-- ===========================================================================
-- Stripe Accounts
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "public"."stripe_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_account_id" "text" NOT NULL,
    "onboarding_complete" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."stripe_accounts" OWNER TO "postgres";

ALTER TABLE ONLY "public"."stripe_accounts"
    ADD CONSTRAINT "stripe_accounts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."stripe_accounts"
    ADD CONSTRAINT "stripe_accounts_user_id_key" UNIQUE ("user_id");

ALTER TABLE ONLY "public"."stripe_accounts"
    ADD CONSTRAINT "stripe_accounts_stripe_account_id_key" UNIQUE ("stripe_account_id");

ALTER TABLE ONLY "public"."stripe_accounts"
    ADD CONSTRAINT "stripe_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE "public"."stripe_accounts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stripe_accounts_select" ON "public"."stripe_accounts" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));
CREATE POLICY "stripe_accounts_insert" ON "public"."stripe_accounts" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

GRANT ALL ON TABLE "public"."stripe_accounts" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."stripe_accounts" TO "authenticated";

-- ===========================================================================
-- Conversations
-- ===========================================================================

CREATE TABLE "public"."conversations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "order_id" uuid NOT NULL,
  "orderer_id" uuid,
  "swiper_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conversations_order_id_key" UNIQUE ("order_id"),
  CONSTRAINT "conversations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders" ("id") ON DELETE CASCADE,
  CONSTRAINT "conversations_orderer_id_fkey" FOREIGN KEY ("orderer_id") REFERENCES "public"."profiles" ("id") ON DELETE CASCADE,
  CONSTRAINT "conversations_swiper_id_fkey" FOREIGN KEY ("swiper_id") REFERENCES "public"."profiles" ("id") ON DELETE CASCADE
);

CREATE INDEX "conversations_order_id_idx" ON "public"."conversations" ("order_id");

ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their conversations"
  ON "public"."conversations" FOR SELECT
  TO authenticated
  USING (auth.uid() IN ("orderer_id", "swiper_id"));

CREATE POLICY "Swiper can create conversation on accept"
  ON "public"."conversations" FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = "swiper_id");

GRANT SELECT, INSERT ON "public"."conversations" TO authenticated;
GRANT ALL ON "public"."conversations" TO service_role;

-- ===========================================================================
-- Messages
-- ===========================================================================

CREATE TABLE "public"."messages" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL,
  "sender_id" uuid,
  "body" text NOT NULL CHECK (char_length("body") BETWEEN 1 AND 1000),
  "sent_at" timestamptz NOT NULL DEFAULT now(),
  "read_at" timestamptz,
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations" ("id") ON DELETE CASCADE,
  CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles" ("id") ON DELETE SET NULL
);

CREATE INDEX "messages_conversation_sent_idx" ON "public"."messages" ("conversation_id", "sent_at");

ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view messages"
  ON "public"."messages" FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "public"."conversations" c
      WHERE c.id = "conversation_id"
        AND auth.uid() IN (c."orderer_id", c."swiper_id")
    )
  );

CREATE POLICY "Participants can send messages"
  ON "public"."messages" FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = "sender_id"
    AND EXISTS (
      SELECT 1 FROM "public"."conversations" c
      WHERE c.id = "conversation_id"
        AND auth.uid() IN (c."orderer_id", c."swiper_id")
    )
  );

CREATE POLICY "Participants can mark messages read"
  ON "public"."messages" FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "public"."conversations" c
      WHERE c.id = "conversation_id"
        AND auth.uid() IN (c."orderer_id", c."swiper_id")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."conversations" c
      WHERE c.id = "conversation_id"
        AND auth.uid() IN (c."orderer_id", c."swiper_id")
    )
  );

GRANT SELECT, INSERT ON "public"."messages" TO authenticated;
GRANT UPDATE (read_at) ON "public"."messages" TO authenticated;
GRANT ALL ON "public"."conversations" TO service_role;
GRANT ALL ON "public"."messages" TO service_role;

-- ===========================================================================
-- Shared function grants
-- ===========================================================================

REVOKE ALL ON FUNCTION "public"."find_nearby_eateries"("user_lat" double precision, "user_lng" double precision, "radius_km" double precision) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."find_nearby_eateries"("user_lat" double precision, "user_lng" double precision, "radius_km" double precision) TO "service_role";
GRANT ALL ON FUNCTION "public"."find_nearby_eateries"("user_lat" double precision, "user_lng" double precision, "radius_km" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_nearby_eateries"("user_lat" double precision, "user_lng" double precision, "radius_km" double precision) TO "anon";

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "anon";

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
