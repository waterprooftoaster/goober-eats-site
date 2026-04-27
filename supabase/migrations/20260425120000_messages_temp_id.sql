-- Add temp_id column to messages for client-side optimistic UI dedupe.
-- Nullable; existing rows and clients that omit it continue working
-- unchanged. The server echoes whatever the client sent so the
-- realtime INSERT payload carries temp_id back to the originating
-- client for dedupe-by-temp_id (replaces the optimistic local entry
-- with the canonical server row).
--
-- Justification recorded in docs/redesign/SCOPE_AMENDMENTS.md (A07-01).
-- This is the only frozen-surface migration permitted in Session 07.

ALTER TABLE "public"."messages"
  ADD COLUMN IF NOT EXISTS "temp_id" text;
