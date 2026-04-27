-- Migration: Chat Realtime Infrastructure
-- Removes Twilio proxy remnants, redesigns messages table for typed messages
-- with expiry, enables Supabase Realtime, adds delivery-photos storage bucket,
-- and sets up automated message cleanup.

-- ============================================================
-- 1. Drop proxy_sessions (Twilio SMS proxy — no longer used)
-- ============================================================
DROP TABLE IF EXISTS "public"."proxy_sessions";

-- ============================================================
-- 2. message_type enum
-- ============================================================
CREATE TYPE "public"."message_type" AS ENUM ('system', 'text', 'delivery_photo');

-- ============================================================
-- 3. Alter messages table
-- ============================================================

-- Drop the old body constraint (will be replaced with a composite one below)
ALTER TABLE "public"."messages" DROP CONSTRAINT IF EXISTS "messages_body_check";

-- Make body nullable to allow delivery_photo messages with no text
ALTER TABLE "public"."messages" ALTER COLUMN "body" DROP NOT NULL;

-- Add new columns
ALTER TABLE "public"."messages"
  ADD COLUMN "message_type" "public"."message_type" NOT NULL DEFAULT 'text',
  ADD COLUMN "expires_at"   timestamptz,
  ADD COLUMN "image_url"    text;

-- Enforce: text/system require a non-empty body; delivery_photo requires image_url
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_content_check" CHECK (
  (message_type = 'delivery_photo' AND image_url IS NOT NULL)
  OR (
    message_type IN ('text', 'system')
    AND body IS NOT NULL
    AND char_length(body) BETWEEN 1 AND 1000
  )
);

-- Index for efficient cleanup queries
CREATE INDEX "messages_expires_at_idx" ON "public"."messages" ("expires_at");

-- ============================================================
-- 4. Trigger: auto-set expires_at on INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION "public"."set_message_expires_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.message_type = 'delivery_photo' THEN
    NEW.expires_at := now() + INTERVAL '7 days';
  ELSE
    NEW.expires_at := now() + INTERVAL '48 hours';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "message_expires_at_trigger"
  BEFORE INSERT ON "public"."messages"
  FOR EACH ROW EXECUTE FUNCTION "public"."set_message_expires_at"();

-- ============================================================
-- 5. Enable Realtime for messages (INSERT streaming)
-- ============================================================
-- Adds messages to the supabase_realtime publication.
-- Clients subscribe with event: 'INSERT' to receive only new messages.
ALTER PUBLICATION supabase_realtime ADD TABLE "public"."messages";

-- ============================================================
-- 6. Storage bucket: delivery-photos
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-photos',
  'delivery-photos',
  false,
  1048576,            -- 1 MB
  ARRAY['image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. Storage RLS policies
-- Path convention: {order_id}/{filename}
-- The first folder segment encodes the order_id for policy checks.
-- ============================================================

-- Only the swiper for that order can upload
CREATE POLICY "Swipers can upload delivery photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-photos'
    AND EXISTS (
      SELECT 1
      FROM "public"."conversations" c
      WHERE c.order_id::text = (storage.foldername(name))[1]
        AND c.swiper_id = auth.uid()
    )
  );

-- Both participants can read
CREATE POLICY "Participants can view delivery photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'delivery-photos'
    AND EXISTS (
      SELECT 1
      FROM "public"."conversations" c
      WHERE c.order_id::text = (storage.foldername(name))[1]
        AND auth.uid() IN (c.orderer_id, c.swiper_id)
    )
  );

-- ============================================================
-- 8. Cleanup function + pg_cron job
-- ============================================================

-- Deletes storage objects for expired delivery photos, then the message rows.
-- Uses session_replication_role = 'replica' to bypass the storage.protect_delete()
-- trigger — safe here because SECURITY DEFINER runs as the postgres superuser and
-- the deletion is intentional (expiry cleanup, not accidental data loss).
CREATE OR REPLACE FUNCTION "public"."cleanup_expired_messages"()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Bypass the storage protect_delete trigger for intentional expiry cleanup
  SET LOCAL session_replication_role = 'replica';

  -- Remove storage objects for expired delivery photos
  DELETE FROM storage.objects
  WHERE bucket_id = 'delivery-photos'
    AND name IN (
      SELECT image_url
      FROM "public"."messages"
      WHERE message_type = 'delivery_photo'
        AND expires_at < now()
        AND image_url IS NOT NULL
    );

  -- Delete expired message rows
  DELETE FROM "public"."messages"
  WHERE expires_at < now();
END;
$$;

-- Schedule hourly cleanup via pg_cron if available.
-- On Supabase cloud: enable pg_cron in Dashboard → Database → Extensions,
-- then run: SELECT cron.schedule('cleanup-expired-messages', '0 * * * *', 'SELECT public.cleanup_expired_messages()');
-- On local Docker: pg_cron requires shared_preload_libraries — skipped here if not loaded.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron') THEN
    PERFORM cron.schedule(
      'cleanup-expired-messages',
      '0 * * * *',
      'SELECT public.cleanup_expired_messages()'
    );
  ELSE
    RAISE NOTICE 'pg_cron schema not found — skipping cron job registration. Enable pg_cron and rerun the SELECT cron.schedule(...) call manually.';
  END IF;
END;
$$;
