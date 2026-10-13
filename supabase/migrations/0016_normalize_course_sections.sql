-- Sections own their type and schedule. stubcodes gain course_type (so one
-- course can hold both a lecture and a lab); courses become pure identity
-- (course_code + course_name) with UNIQUE (course_code); schedules key off
-- course_stubcode alone. IF EXISTS / IF NOT EXISTS keeps this re-runnable.

BEGIN;

ALTER TABLE public.stubcodes
  ADD COLUMN IF NOT EXISTS course_type course_type_enum NOT NULL DEFAULT 'lect';

-- Carry the existing course-level type down before that column is dropped.
UPDATE public.stubcodes s
   SET course_type = c.course_type
  FROM public.courses c
 WHERE s.course_id = c.course_id
   AND s.course_type IS DISTINCT FROM c.course_type;

ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_code_type_key;

ALTER TABLE public.courses
  DROP COLUMN IF EXISTS course_type;

ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_code_key;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_code_key UNIQUE (course_code);

ALTER TABLE public.stubcode_schedules
  DROP CONSTRAINT IF EXISTS stubcode_schedules_course_id_fkey;

ALTER TABLE public.stubcode_schedules
  DROP COLUMN IF EXISTS course_id;

COMMIT;
