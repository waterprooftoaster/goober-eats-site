-- Make conversations.swiper_id nullable so the un-accept route can revoke
-- the prior swiper's RLS access without violating NOT NULL.
ALTER TABLE public.conversations
  ALTER COLUMN swiper_id DROP NOT NULL;

-- Track when the current swiper assignment began. Set to NOW() on every
-- accept (initial + re-accept), nulled on un-accept. The swiper-side chat
-- UI filters messages to sent_at >= swiper_assigned_at so a swiper picking
-- up a previously-cancelled order sees a clean slate (no prior swiper's
-- chat history, no "no longer available" system message).
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS swiper_assigned_at timestamptz;

-- Backfill existing in-progress conversations to created_at so currently
-- active swipers don't suddenly lose their thread.
UPDATE public.conversations
  SET swiper_assigned_at = created_at
  WHERE swiper_id IS NOT NULL AND swiper_assigned_at IS NULL;
