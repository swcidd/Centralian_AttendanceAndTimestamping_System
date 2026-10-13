-- ============================================================
-- 0016_normalize_course_sections.sql
-- Normalise course/section so that stubcodes are first-class
-- sections rather than rows piggy-backing on their course.
--
-- Two product requirements drive this:
--   1. New stubcodes must be independent of one another under the
--      same course. Previously stubcode_schedules carried a
--      course_id, so every section under a course shared one
--      schedule/room/terminal and an update keyed on course_id
--      touched all of them. Schedules now hang off the section
--      (course_stubcode) alone.
--   2. A course must be able to offer BOTH a lecture and a lab.
--      course_type therefore moves from courses to stubcodes, and
--      the `UNIQUE (course_code, course_type)` workaround (which
--      forced a duplicate course row per type) is replaced by
--      `UNIQUE (course_code)`.
--
-- Guarded with IF EXISTS / IF NOT EXISTS so the file is re-runnable
-- against the already-migrated database.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Lecture/lab becomes a property of the section.
-- ------------------------------------------------------------
ALTER TABLE public.stubcodes
  ADD COLUMN IF NOT EXISTS course_type course_type_enum NOT NULL DEFAULT 'lect';

-- Carry any existing course-level type down onto its sections while
-- the source column is still present.
UPDATE public.stubcodes s
   SET course_type = c.course_type
  FROM public.courses c
 WHERE s.course_id = c.course_id
   AND s.course_type IS DISTINCT FROM c.course_type;

-- ------------------------------------------------------------
-- 2. A course is now pure subject identity (code + name).
-- ------------------------------------------------------------
ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_code_type_key;

ALTER TABLE public.courses
  DROP COLUMN IF EXISTS course_type;

ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_code_key;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_code_key UNIQUE (course_code);

-- ------------------------------------------------------------
-- 3. Schedules belong to the section alone.
--    course_id was a transitive dependency (derivable through
--    stubcodes) and the reason stubcodes were not independent.
-- ------------------------------------------------------------
ALTER TABLE public.stubcode_schedules
  DROP CONSTRAINT IF EXISTS stubcode_schedules_course_id_fkey;

ALTER TABLE public.stubcode_schedules
  DROP COLUMN IF EXISTS course_id;

COMMIT;
