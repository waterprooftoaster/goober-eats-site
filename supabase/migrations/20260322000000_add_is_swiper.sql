-- Add is_swiper flag to profiles
-- Note: the existing profiles_update RLS policy (auth.uid() = id)
-- already allows users to update their own row, so no new policy is needed.
ALTER TABLE profiles
  ADD COLUMN is_swiper BOOLEAN NOT NULL DEFAULT FALSE;

-- Enforce at DB level: a swiper must always have a school selected.
-- Closes the race window between the application guard and the write.
ALTER TABLE profiles
  ADD CONSTRAINT swiper_requires_school
    CHECK (NOT is_swiper OR school_id IS NOT NULL);
