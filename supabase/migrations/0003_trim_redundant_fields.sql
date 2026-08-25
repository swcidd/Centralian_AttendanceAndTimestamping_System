-- ============================================================
-- 0003_trim_redundant_fields.sql
-- Drops columns that exist on the live database but are never
-- read or written by any code path.
-- ============================================================

-- IF EXISTS: 0001_core_schema.sql was edited after this table was
-- already live, so it never creates these columns on a fresh
-- database (e.g. a Supabase preview branch) — only the existing
-- production database still has them to drop.

-- Students only ever collects School_ID/First_Name/Last_Name during
-- registration; nothing writes Course_Program or Year_Level.
ALTER TABLE Students DROP COLUMN IF EXISTS Course_Program;
ALTER TABLE Students DROP COLUMN IF EXISTS Year_Level;

-- Superseded by Courses.Absent_After_Minutes (computed relative to
-- Started_At in finalize_absences()). Nothing reads or writes
-- Expires_At, and no code creates Active_Sessions rows yet either.
ALTER TABLE Active_Sessions DROP COLUMN IF EXISTS Expires_At;
