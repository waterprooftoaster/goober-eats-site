-- @file 20260502000001_complaints_complainant_idx.sql
-- @description Adds an index on complaints.complainant_id; the RLS policies
--   on complaints (complaints_insert WITH CHECK and complaints_select USING)
--   filter on this column for every authenticated read/insert and the column
--   was unindexed in the original migration (20260430000001_complaints_table).
--   Without this index every RLS evaluation seq-scans the table.

CREATE INDEX IF NOT EXISTS "complaints_complainant_id_idx"
  ON "public"."complaints" ("complainant_id");
