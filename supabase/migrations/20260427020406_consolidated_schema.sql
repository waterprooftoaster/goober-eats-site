


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


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."message_type" AS ENUM (
    'system',
    'text',
    'completion_photo'
);


ALTER TYPE "public"."message_type" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'open',
    'in_progress',
    'completed',
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


CREATE OR REPLACE FUNCTION "public"."check_email_exists"("lookup_email" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = lower(lookup_email));
$$;


ALTER FUNCTION "public"."check_email_exists"("lookup_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_messages"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Bypass storage.protect_delete trigger for intentional expiry cleanup.
  SET LOCAL session_replication_role = 'replica';

  -- Remove storage objects for expired completion photos.
  DELETE FROM storage.objects
  WHERE bucket_id = 'completion-photos'
    AND name IN (
      SELECT image_url
      FROM "public"."messages"
      WHERE message_type = 'completion_photo'
        AND expires_at < now()
        AND image_url IS NOT NULL
    );

  -- Delete expired message rows (text/system + completion-photo).
  DELETE FROM "public"."messages"
  WHERE expires_at < now();
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_messages"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."set_message_expires_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.message_type = 'completion_photo' THEN
    NEW.expires_at := now() + INTERVAL '7 days';
  ELSE
    NEW.expires_at := now() + INTERVAL '48 hours';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_message_expires_at"() OWNER TO "postgres";


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

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "orderer_id" "uuid",
    "swiper_id" "uuid",
    "swiper_assigned_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "body" "text",
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "message_type" "public"."message_type" DEFAULT 'text'::"public"."message_type" NOT NULL,
    "expires_at" timestamp with time zone,
    "image_url" "text",
    "temp_id" "text",
    CONSTRAINT "messages_content_check" CHECK (((("message_type" = 'completion_photo'::"public"."message_type") AND ("image_url" IS NOT NULL)) OR (("message_type" = ANY (ARRAY['text'::"public"."message_type", 'system'::"public"."message_type"])) AND ("body" IS NOT NULL) AND (("char_length"("body") >= 1) AND ("char_length"("body") <= 1000)))))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orderer_id" "uuid",
    "swiper_id" "uuid",
    "status" "public"."order_status" DEFAULT 'open'::"public"."order_status" NOT NULL,
    "total_cents" integer NOT NULL,
    "guest_name" "text",
    "guest_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_payment_intent_id" "text",
    "guest_access_token" "uuid",
    "anon_user_id" "uuid",
    "school_id" "uuid" NOT NULL,
    "restaurant_name" "text" NOT NULL,
    "cart_screenshot_urls" "text"[] NOT NULL,
    "subtotal_cents" integer NOT NULL,
    CONSTRAINT "orders_cart_screenshot_urls_check" CHECK (((("array_length"("cart_screenshot_urls", 1) >= 1) AND ("array_length"("cart_screenshot_urls", 1) <= 5)) AND ("array_length"("array_remove"("cart_screenshot_urls", NULL::"text"), 1) = "array_length"("cart_screenshot_urls", 1)))),
    CONSTRAINT "orders_orderer_or_guest" CHECK ((("orderer_id" IS NOT NULL) OR ("guest_name" IS NOT NULL))),
    CONSTRAINT "orders_restaurant_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "restaurant_name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "restaurant_name")) <= 80))),
    CONSTRAINT "orders_subtotal_cents_check" CHECK (("subtotal_cents" >= 0)),
    CONSTRAINT "orders_total_cents_check" CHECK (("total_cents" >= 0))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "stripe_payment_intent_id" "text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "platform_fee_cents" integer DEFAULT 0 NOT NULL,
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "payer_id" "uuid",
    "payee_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payments_amount_cents_check" CHECK (("amount_cents" > 0)),
    CONSTRAINT "payments_platform_fee_cents_check" CHECK (("platform_fee_cents" >= 0))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "school_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_swiper" boolean DEFAULT false NOT NULL,
    CONSTRAINT "profiles_full_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "full_name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "full_name")) <= 100))),
    CONSTRAINT "swiper_requires_school" CHECK (((NOT "is_swiper") OR ("school_id" IS NOT NULL)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schools" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."schools" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_account_id" "text" NOT NULL,
    "onboarding_complete" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stripe_accounts" OWNER TO "postgres";


ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_stripe_payment_intent_id_key" UNIQUE ("stripe_payment_intent_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schools"
    ADD CONSTRAINT "schools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schools"
    ADD CONSTRAINT "schools_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."stripe_accounts"
    ADD CONSTRAINT "stripe_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_accounts"
    ADD CONSTRAINT "stripe_accounts_stripe_account_id_key" UNIQUE ("stripe_account_id");



ALTER TABLE ONLY "public"."stripe_accounts"
    ADD CONSTRAINT "stripe_accounts_user_id_key" UNIQUE ("user_id");



CREATE INDEX "conversations_order_id_idx" ON "public"."conversations" USING "btree" ("order_id");



CREATE UNIQUE INDEX "idx_orders_guest_access_token" ON "public"."orders" USING "btree" ("guest_access_token") WHERE ("guest_access_token" IS NOT NULL);



CREATE UNIQUE INDEX "idx_orders_stripe_payment_intent_id" ON "public"."orders" USING "btree" ("stripe_payment_intent_id") WHERE ("stripe_payment_intent_id" IS NOT NULL);



CREATE INDEX "messages_conversation_sent_idx" ON "public"."messages" USING "btree" ("conversation_id", "sent_at");



CREATE INDEX "messages_expires_at_idx" ON "public"."messages" USING "btree" ("expires_at");



CREATE INDEX "orders_cart_screenshot_urls_gin_idx" ON "public"."orders" USING "gin" ("cart_screenshot_urls");



CREATE INDEX "orders_orderer_id_idx" ON "public"."orders" USING "btree" ("orderer_id");



CREATE INDEX "orders_school_id_idx" ON "public"."orders" USING "btree" ("school_id");



CREATE INDEX "orders_school_id_open_idx" ON "public"."orders" USING "btree" ("school_id") WHERE (("status" = 'open'::"public"."order_status") AND ("swiper_id" IS NULL));



CREATE INDEX "orders_status_idx" ON "public"."orders" USING "btree" ("status") WHERE ("status" = 'open'::"public"."order_status");



CREATE INDEX "orders_swiper_id_idx" ON "public"."orders" USING "btree" ("swiper_id") WHERE ("swiper_id" IS NOT NULL);



CREATE INDEX "payments_order_id_idx" ON "public"."payments" USING "btree" ("order_id");



CREATE INDEX "payments_payee_id_idx" ON "public"."payments" USING "btree" ("payee_id");



CREATE INDEX "payments_payer_id_idx" ON "public"."payments" USING "btree" ("payer_id");



CREATE INDEX "profiles_school_id_idx" ON "public"."profiles" USING "btree" ("school_id");



CREATE OR REPLACE TRIGGER "message_expires_at_trigger" BEFORE INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."set_message_expires_at"();



CREATE OR REPLACE TRIGGER "orders_set_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "schools_set_updated_at" BEFORE UPDATE ON "public"."schools" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_orderer_id_fkey" FOREIGN KEY ("orderer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_swiper_id_fkey" FOREIGN KEY ("swiper_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_anon_user_id_fkey" FOREIGN KEY ("anon_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_orderer_id_fkey" FOREIGN KEY ("orderer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_swiper_id_fkey" FOREIGN KEY ("swiper_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_payee_id_fkey" FOREIGN KEY ("payee_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stripe_accounts"
    ADD CONSTRAINT "stripe_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Anon orderers can send messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "sender_id") AND (EXISTS ( SELECT 1
   FROM ("public"."conversations" "c"
     JOIN "public"."orders" "o" ON (("o"."id" = "c"."order_id")))
  WHERE (("c"."id" = "messages"."conversation_id") AND ("o"."anon_user_id" = "auth"."uid"()))))));



CREATE POLICY "Anon orderers can view their conversations" ON "public"."conversations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "conversations"."order_id") AND ("o"."anon_user_id" = "auth"."uid"())))));



CREATE POLICY "Anon orderers can view their messages" ON "public"."messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."conversations" "c"
     JOIN "public"."orders" "o" ON (("o"."id" = "c"."order_id")))
  WHERE (("c"."id" = "messages"."conversation_id") AND ("o"."anon_user_id" = "auth"."uid"())))));



CREATE POLICY "Participants can mark messages read" ON "public"."messages" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ((( SELECT "auth"."uid"() AS "uid") = "c"."orderer_id") OR (( SELECT "auth"."uid"() AS "uid") = "c"."swiper_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ((( SELECT "auth"."uid"() AS "uid") = "c"."orderer_id") OR (( SELECT "auth"."uid"() AS "uid") = "c"."swiper_id"))))));



CREATE POLICY "Participants can send messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ((( SELECT "auth"."uid"() AS "uid") = "c"."orderer_id") OR (( SELECT "auth"."uid"() AS "uid") = "c"."swiper_id")))))));



CREATE POLICY "Participants can view messages" ON "public"."messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ((( SELECT "auth"."uid"() AS "uid") = "c"."orderer_id") OR (( SELECT "auth"."uid"() AS "uid") = "c"."swiper_id"))))));



CREATE POLICY "Swiper can create conversation on accept" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "swiper_id"));



CREATE POLICY "Users can view their conversations" ON "public"."conversations" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "orderer_id") OR (( SELECT "auth"."uid"() AS "uid") = "swiper_id")));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_insert" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "orderer_id"));



CREATE POLICY "orders_select" ON "public"."orders" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "orderer_id") OR (( SELECT "auth"."uid"() AS "uid") = "swiper_id") OR (( SELECT "auth"."uid"() AS "uid") = "anon_user_id") OR (("status" = 'open'::"public"."order_status") AND ("swiper_id" IS NULL) AND ("school_id" = ( SELECT "p"."school_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "orders_update" ON "public"."orders" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "orderer_id") OR (( SELECT "auth"."uid"() AS "uid") = "swiper_id"))) WITH CHECK ((((( SELECT "auth"."uid"() AS "uid") = "orderer_id") AND ("swiper_id" IS DISTINCT FROM ( SELECT "auth"."uid"() AS "uid"))) OR (( SELECT "auth"."uid"() AS "uid") = "swiper_id")));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_select" ON "public"."payments" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "payer_id") OR (( SELECT "auth"."uid"() AS "uid") = "payee_id")));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



ALTER TABLE "public"."schools" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schools_anon_select" ON "public"."schools" FOR SELECT TO "anon" USING (true);



CREATE POLICY "schools_select" ON "public"."schools" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."stripe_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stripe_accounts_insert" ON "public"."stripe_accounts" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "stripe_accounts_select" ON "public"."stripe_accounts" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."orders";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
























































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































REVOKE ALL ON FUNCTION "public"."check_email_exists"("lookup_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_email_exists"("lookup_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_email_exists"("lookup_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_email_exists"("lookup_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_messages"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_messages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_messages"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_message_expires_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_message_expires_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_message_expires_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";

















































































GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."schools" TO "anon";
GRANT ALL ON TABLE "public"."schools" TO "authenticated";
GRANT ALL ON TABLE "public"."schools" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_accounts" TO "anon";
GRANT ALL ON TABLE "public"."stripe_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_accounts" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































--
-- Dumped schema changes for auth and storage
--

CREATE POLICY "Cart screenshots viewable by order participants" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'cart-screenshots'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("objects"."name" = ANY ("o"."cart_screenshot_urls")) AND ((( SELECT "auth"."uid"() AS "uid") = "o"."orderer_id") OR (( SELECT "auth"."uid"() AS "uid") = "o"."swiper_id") OR (( SELECT "auth"."uid"() AS "uid") = "o"."anon_user_id")))))));



CREATE POLICY "Participants can view completion photos" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'completion-photos'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE ((("c"."order_id")::"text" = ("storage"."foldername"("objects"."name"))[1]) AND ((( SELECT "auth"."uid"() AS "uid") = "c"."orderer_id") OR (( SELECT "auth"."uid"() AS "uid") = "c"."swiper_id")))))));



CREATE POLICY "Swipers can upload completion photos" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'completion-photos'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE ((("c"."order_id")::"text" = ("storage"."foldername"("objects"."name"))[1]) AND ("c"."swiper_id" = ( SELECT "auth"."uid"() AS "uid")))))));


-- Provision storage buckets referenced by the policies above. Idempotent so
-- `db reset` and re-applies stay safe. Buckets are private — access is gated
-- by the storage.objects policies and by signed URLs minted server-side.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('cart-screenshots', 'cart-screenshots', false),
  ('completion-photos', 'completion-photos', false)
ON CONFLICT (id) DO NOTHING;


-- Self-delete RPC. Bypasses the GoTrue admin endpoint, which the local
-- Supabase container rejects when called with the new sb_secret_ HS256 keys
-- (the container is configured for ES256-signed JWTs). SECURITY DEFINER so
-- it can reach into auth.users; gated on auth.uid() = target_id so callers
-- can only delete their own account.
CREATE OR REPLACE FUNCTION public.delete_user_account(target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> target_id THEN
    RAISE EXCEPTION 'forbidden: can only delete own account';
  END IF;
  DELETE FROM auth.users WHERE id = target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;



