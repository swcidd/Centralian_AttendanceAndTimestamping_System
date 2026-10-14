-- Section identity becomes (course_stubcode, course_type): the same registrar
-- number may now exist as both a lecture and a lab under one course. Every
-- table keyed by a section gains course_type, and the direct children of
-- stubcodes get composite FKs. Rows are backfilled from stubcodes, which is
-- unique on course_stubcode today, so the mapping is unambiguous.
-- One-shot: ADD CONSTRAINT is not guarded, so re-running would fail.

BEGIN;

-- 1. Drop the single-column FKs onto stubcodes and its primary key; both
--    block the composite key added below.
ALTER TABLE public.stubcode_instructors
  DROP CONSTRAINT IF EXISTS stubcode_instructors_course_stubcode_fkey;
ALTER TABLE public.enrollments
  DROP CONSTRAINT IF EXISTS enrollments_course_stubcode_fkey;
ALTER TABLE public.stubcode_schedules
  DROP CONSTRAINT IF EXISTS stubcode_schedules_course_stubcode_fkey;
ALTER TABLE public.room_modes
  DROP CONSTRAINT IF EXISTS room_modes_course_stubcode_fkey;

DO $$
DECLARE pk text;
BEGIN
  SELECT conname INTO pk
  FROM pg_constraint
  WHERE conrelid = 'public.stubcodes'::regclass AND contype = 'p';
  IF pk IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.stubcodes DROP CONSTRAINT %I', pk);
  END IF;
END $$;

-- 2. course_type on every section-keyed table, backfilled from the section.
ALTER TABLE public.stubcode_instructors ADD COLUMN IF NOT EXISTS course_type course_type_enum;
ALTER TABLE public.enrollments          ADD COLUMN IF NOT EXISTS course_type course_type_enum;
ALTER TABLE public.stubcode_schedules   ADD COLUMN IF NOT EXISTS course_type course_type_enum;
ALTER TABLE public.room_modes           ADD COLUMN IF NOT EXISTS course_type course_type_enum;
ALTER TABLE public.class_sessions       ADD COLUMN IF NOT EXISTS course_type course_type_enum;
ALTER TABLE public.attendance           ADD COLUMN IF NOT EXISTS course_type course_type_enum;
ALTER TABLE public.scan_logs            ADD COLUMN IF NOT EXISTS course_type course_type_enum;

UPDATE public.stubcode_instructors c SET course_type = s.course_type
  FROM public.stubcodes s WHERE s.course_stubcode = c.course_stubcode;
UPDATE public.enrollments c SET course_type = s.course_type
  FROM public.stubcodes s WHERE s.course_stubcode = c.course_stubcode;
UPDATE public.stubcode_schedules c SET course_type = s.course_type
  FROM public.stubcodes s WHERE s.course_stubcode = c.course_stubcode;
UPDATE public.room_modes c SET course_type = s.course_type
  FROM public.stubcodes s WHERE s.course_stubcode = c.course_stubcode;
UPDATE public.class_sessions c SET course_type = s.course_type
  FROM public.stubcodes s WHERE s.course_stubcode = c.course_stubcode;
UPDATE public.attendance c SET course_type = s.course_type
  FROM public.stubcodes s WHERE s.course_stubcode = c.course_stubcode;
UPDATE public.scan_logs c SET course_type = s.course_type
  FROM public.stubcodes s WHERE s.course_stubcode = c.course_stubcode;

ALTER TABLE public.stubcode_instructors ALTER COLUMN course_type SET NOT NULL;
ALTER TABLE public.enrollments          ALTER COLUMN course_type SET NOT NULL;
ALTER TABLE public.stubcode_schedules   ALTER COLUMN course_type SET NOT NULL;
ALTER TABLE public.room_modes           ALTER COLUMN course_type SET NOT NULL;
ALTER TABLE public.class_sessions       ALTER COLUMN course_type SET NOT NULL;
ALTER TABLE public.attendance           ALTER COLUMN course_type SET NOT NULL;

-- 3. Section identity.
ALTER TABLE public.stubcodes
  ADD CONSTRAINT stubcodes_pkey PRIMARY KEY (course_stubcode, course_type);

-- 4. Composite FKs for the direct children of a section.
ALTER TABLE public.stubcode_instructors ADD CONSTRAINT stubcode_instructors_stubcode_fk
  FOREIGN KEY (course_stubcode, course_type)
  REFERENCES public.stubcodes (course_stubcode, course_type)
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_stubcode_fk
  FOREIGN KEY (course_stubcode, course_type)
  REFERENCES public.stubcodes (course_stubcode, course_type)
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.stubcode_schedules ADD CONSTRAINT stubcode_schedules_stubcode_fk
  FOREIGN KEY (course_stubcode, course_type)
  REFERENCES public.stubcodes (course_stubcode, course_type)
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.room_modes ADD CONSTRAINT room_modes_stubcode_fk
  FOREIGN KEY (course_stubcode, course_type)
  REFERENCES public.stubcodes (course_stubcode, course_type)
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 5. Uniques that must carry the type now that a number repeats.
ALTER TABLE public.stubcode_instructors DROP CONSTRAINT IF EXISTS stubcode_instructors_pkey;
ALTER TABLE public.stubcode_instructors ADD CONSTRAINT stubcode_instructors_pkey
  PRIMARY KEY (course_stubcode, course_type, instructor_id);

ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_stubcode_student_key;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_stubcode_student_key
  UNIQUE (course_stubcode, course_type, student_id);

ALTER TABLE public.stubcode_schedules DROP CONSTRAINT IF EXISTS stubcode_schedules_slot_key;
ALTER TABLE public.stubcode_schedules ADD CONSTRAINT stubcode_schedules_slot_key
  UNIQUE (course_stubcode, course_type, schedule_day, schedule_start);

-- 6. An ownership check on a section must match the same type, or a section's
--    owner would also hold write on the other type sharing its number.
DROP POLICY IF EXISTS enrollments_write_own ON public.enrollments;
CREATE POLICY enrollments_write_own ON public.enrollments
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stubcodes s
    WHERE s.course_stubcode = enrollments.course_stubcode
      AND s.course_type = enrollments.course_type
      AND s.instructor_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stubcodes s
    WHERE s.course_stubcode = enrollments.course_stubcode
      AND s.course_type = enrollments.course_type
      AND s.instructor_id = auth.uid()));

DROP POLICY IF EXISTS schedules_write_own ON public.stubcode_schedules;
CREATE POLICY schedules_write_own ON public.stubcode_schedules
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stubcodes s
    WHERE s.course_stubcode = stubcode_schedules.course_stubcode
      AND s.course_type = stubcode_schedules.course_type
      AND s.instructor_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stubcodes s
    WHERE s.course_stubcode = stubcode_schedules.course_stubcode
      AND s.course_type = stubcode_schedules.course_type
      AND s.instructor_id = auth.uid()));

DROP POLICY IF EXISTS class_sessions_write_own ON public.class_sessions;
CREATE POLICY class_sessions_write_own ON public.class_sessions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stubcodes s
    WHERE s.course_stubcode = class_sessions.course_stubcode
      AND s.course_type = class_sessions.course_type
      AND s.instructor_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stubcodes s
    WHERE s.course_stubcode = class_sessions.course_stubcode
      AND s.course_type = class_sessions.course_type
      AND s.instructor_id = auth.uid()));

DROP POLICY IF EXISTS attendance_write_own ON public.attendance;
CREATE POLICY attendance_write_own ON public.attendance
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stubcodes s
    WHERE s.course_stubcode = attendance.course_stubcode
      AND s.course_type = attendance.course_type
      AND s.instructor_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stubcodes s
    WHERE s.course_stubcode = attendance.course_stubcode
      AND s.course_type = attendance.course_type
      AND s.instructor_id = auth.uid()));

COMMIT;
