-- Rebuild to the room-mode design. Postgres refuses in-place column changes
-- while a policy/FK depends on the column, and the legacy shape shares almost
-- no columns with the new one; the existing instructor row is carried over.

CREATE TABLE IF NOT EXISTS public.instructors (
  instructor_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  first_name    varchar NOT NULL,
  last_name     varchar NOT NULL,
  school_id      varchar,
  department     varchar,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    INSERT INTO public.instructors (instructor_id, first_name, last_name, school_id)
    SELECT profile_id, first_name, last_name, school_id
    FROM public.profiles
    ON CONFLICT (instructor_id) DO NOTHING;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.finalize_absences();
DROP FUNCTION IF EXISTS public.claim_next_device_command(varchar);
DROP FUNCTION IF EXISTS public.claim_next_device_command(character varying);

DROP TABLE IF EXISTS public.device_commands     CASCADE;
DROP TABLE IF EXISTS public.attendance_logs     CASCADE;
DROP TABLE IF EXISTS public.active_sessions     CASCADE;
DROP TABLE IF EXISTS public.enrollments         CASCADE;
DROP TABLE IF EXISTS public.attendance          CASCADE;
DROP TABLE IF EXISTS public.class_sessions      CASCADE;
DROP TABLE IF EXISTS public.room_modes          CASCADE;
DROP TABLE IF EXISTS public.scan_logs           CASCADE;
DROP TABLE IF EXISTS public.student_cards       CASCADE;
DROP TABLE IF EXISTS public.stubcode_instructors CASCADE;
DROP TABLE IF EXISTS public.stubcode_schedules  CASCADE;
DROP TABLE IF EXISTS public.stubcodes           CASCADE;
DROP TABLE IF EXISTS public.courses             CASCADE;
DROP TABLE IF EXISTS public.students            CASCADE;
DROP TABLE IF EXISTS public.profiles            CASCADE;
DROP TABLE IF EXISTS public.devices             CASCADE;

DROP TYPE IF EXISTS public.course_type_enum       CASCADE;
DROP TYPE IF EXISTS public.instructor_role_enum   CASCADE;
DROP TYPE IF EXISTS public.room_mode_enum         CASCADE;
DROP TYPE IF EXISTS public.attendance_status_enum CASCADE;
DROP TYPE IF EXISTS public.attendance_source_enum CASCADE;
DROP TYPE IF EXISTS public.scan_result_enum       CASCADE;

-- instructors outlives the DROP TABLE sweep, so clear every public policy up
-- front to keep the CREATE POLICY block below re-run safe.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE TYPE course_type_enum       AS ENUM ('lect', 'lab');
CREATE TYPE instructor_role_enum   AS ENUM ('co', 'substitute');
CREATE TYPE room_mode_enum         AS ENUM ('enroll', 'attend');
CREATE TYPE attendance_status_enum AS ENUM ('present', 'late', 'absent', 'excused');
CREATE TYPE attendance_source_enum AS ENUM ('system', 'instructor');
CREATE TYPE scan_result_enum       AS ENUM ('ok', 'unknown_card', 'not_enrolled',
                                            'no_active_mode', 'duplicate', 'rejected');

CREATE TABLE public.courses (
  course_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code  varchar NOT NULL,
  course_name  varchar NOT NULL,
  course_type  course_type_enum NOT NULL,
  created_by   uuid REFERENCES public.instructors (instructor_id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courses_code_type_key UNIQUE (course_code, course_type)
);

CREATE TABLE public.students (
  student_id        varchar PRIMARY KEY,
  student_firstname varchar NOT NULL,
  student_lastname  varchar NOT NULL,
  student_program   varchar,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- One active (non-revoked) card per student.
CREATE TABLE public.student_cards (
  card_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id varchar NOT NULL
             REFERENCES public.students (student_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  nfc_uid    varchar NOT NULL,
  issued_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT student_cards_nfc_uid_key UNIQUE (nfc_uid)
);
CREATE UNIQUE INDEX student_cards_one_active_idx
  ON public.student_cards (student_id) WHERE revoked_at IS NULL;

-- course_stubcode is the registrar's globally unique section number.
CREATE TABLE public.stubcodes (
  course_stubcode integer PRIMARY KEY,
  course_id       uuid NOT NULL
                  REFERENCES public.courses (course_id) ON UPDATE CASCADE ON DELETE CASCADE,
  instructor_id   uuid
                  REFERENCES public.instructors (instructor_id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.stubcode_instructors (
  course_stubcode integer NOT NULL
                  REFERENCES public.stubcodes (course_stubcode) ON UPDATE CASCADE ON DELETE CASCADE,
  instructor_id   uuid NOT NULL
                  REFERENCES public.instructors (instructor_id) ON UPDATE CASCADE ON DELETE CASCADE,
  role            instructor_role_enum NOT NULL,
  PRIMARY KEY (course_stubcode, instructor_id)
);

-- Soft drop via dropped_at; one active row per (section, student).
CREATE TABLE public.enrollments (
  enrollment_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_stubcode integer NOT NULL
                  REFERENCES public.stubcodes (course_stubcode) ON UPDATE CASCADE ON DELETE CASCADE,
  student_id      varchar NOT NULL
                  REFERENCES public.students (student_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  enrolled_at     timestamptz NOT NULL DEFAULT now(),
  dropped_at      timestamptz,
  CONSTRAINT enrollments_stubcode_student_key UNIQUE (course_stubcode, student_id),
  CONSTRAINT enrollments_id_stubcode_key UNIQUE (enrollment_id, course_stubcode)
);

-- schedule_day is ISO: 1 = Monday ... 7 = Sunday. Thresholds are minutes
-- after schedule_start, evaluated at tap time.
CREATE TABLE public.stubcode_schedules (
  stubcode_schedule_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id            uuid NOT NULL
                       REFERENCES public.courses (course_id) ON UPDATE CASCADE ON DELETE CASCADE,
  course_stubcode      integer NOT NULL
                       REFERENCES public.stubcodes (course_stubcode) ON UPDATE CASCADE ON DELETE CASCADE,
  schedule_room        varchar NOT NULL,
  schedule_day         smallint NOT NULL,
  schedule_start       time NOT NULL,
  schedule_end         time NOT NULL,
  late_after_minutes   smallint NOT NULL DEFAULT 15,
  absent_after_minutes smallint NOT NULL DEFAULT 30,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stubcode_schedules_slot_key UNIQUE (course_stubcode, schedule_day, schedule_start),
  CONSTRAINT stubcode_schedules_id_stubcode_key UNIQUE (stubcode_schedule_id, course_stubcode),
  CONSTRAINT stubcode_schedules_day_chk CHECK (schedule_day BETWEEN 1 AND 7),
  CONSTRAINT stubcode_schedules_time_chk CHECK (
    schedule_end > schedule_start
    AND late_after_minutes > 0
    AND absent_after_minutes > late_after_minutes
    AND (schedule_end - schedule_start) >= make_interval(mins => absent_after_minutes)
  )
);

-- closed_at IS NULL means the session is open; one row per (slot, date).
CREATE TABLE public.class_sessions (
  session_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stubcode_schedule_id uuid NOT NULL,
  course_stubcode      integer NOT NULL,
  session_date         date NOT NULL,
  closed_at            timestamptz,
  CONSTRAINT class_sessions_slot_date_key UNIQUE (stubcode_schedule_id, session_date),
  CONSTRAINT class_sessions_id_stubcode_key UNIQUE (session_id, course_stubcode),
  CONSTRAINT class_sessions_schedule_fk
    FOREIGN KEY (stubcode_schedule_id, course_stubcode)
    REFERENCES public.stubcode_schedules (stubcode_schedule_id, course_stubcode)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- room is the PK, so a room has at most one active mode; closing = deleting.
CREATE TABLE public.room_modes (
  room            varchar PRIMARY KEY,
  mode            room_mode_enum NOT NULL,
  course_stubcode integer NOT NULL
                  REFERENCES public.stubcodes (course_stubcode) ON UPDATE CASCADE ON DELETE CASCADE,
  session_id      uuid,
  opened_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_modes_session_fk
    FOREIGN KEY (session_id, course_stubcode)
    REFERENCES public.class_sessions (session_id, course_stubcode)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT room_modes_mode_session_chk CHECK (
    (mode = 'enroll' AND session_id IS NULL)
    OR (mode = 'attend' AND session_id IS NOT NULL)
  )
);

-- One row per (session, enrollment); a tap UPDATEs it.
CREATE TABLE public.attendance (
  attendance_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           uuid NOT NULL,
  enrollment_id        uuid NOT NULL,
  course_stubcode      integer NOT NULL,
  status               attendance_status_enum NOT NULL DEFAULT 'absent',
  attendance_timestamp timestamptz,
  source               attendance_source_enum NOT NULL DEFAULT 'system',
  note                 text,
  CONSTRAINT attendance_session_enrollment_key UNIQUE (session_id, enrollment_id),
  CONSTRAINT attendance_session_fk
    FOREIGN KEY (session_id, course_stubcode)
    REFERENCES public.class_sessions (session_id, course_stubcode)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT attendance_enrollment_fk
    FOREIGN KEY (enrollment_id, course_stubcode)
    REFERENCES public.enrollments (enrollment_id, course_stubcode)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- Append-only audit; deliberately no FKs so unknown cards still log.
CREATE TABLE public.scan_logs (
  scan_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scanned_at      timestamptz NOT NULL DEFAULT now(),
  room            varchar NOT NULL,
  nfc_uid         varchar NOT NULL,
  mode            room_mode_enum,
  result          scan_result_enum NOT NULL,
  student_id      varchar,
  course_stubcode integer,
  session_id      uuid
);

-- device_id is the ESP32 MAC; room is derived by the backend.
CREATE TABLE public.devices (
  device_id  varchar PRIMARY KEY,
  room       varchar,
  status     varchar NOT NULL DEFAULT 'ACTIVE'
             CHECK (status IN ('ACTIVE', 'OFFLINE', 'MAINTENANCE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Postgres does not index FK columns automatically.
CREATE INDEX stubcodes_course_id_idx          ON public.stubcodes (course_id);
CREATE INDEX stubcodes_instructor_id_idx      ON public.stubcodes (instructor_id);
CREATE INDEX enrollments_student_id_idx       ON public.enrollments (student_id);
CREATE INDEX stubcode_schedules_stubcode_idx  ON public.stubcode_schedules (course_stubcode);
CREATE INDEX class_sessions_stubcode_idx      ON public.class_sessions (course_stubcode);
CREATE INDEX attendance_session_idx           ON public.attendance (session_id);
CREATE INDEX attendance_enrollment_id_idx     ON public.attendance (enrollment_id);
CREATE INDEX scan_logs_scanned_at_idx         ON public.scan_logs (scanned_at);

-- Reads are open to authenticated users. Writes are owner-scoped, except the
-- device-facing tables (room_modes, scan_logs, student_cards, students) which
-- only the Edge Functions write through the service_role.
ALTER TABLE public.instructors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_cards        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stubcodes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stubcode_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stubcode_schedules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_modes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices              ENABLE ROW LEVEL SECURITY;

CREATE POLICY instructors_select_auth ON public.instructors
  FOR SELECT TO authenticated USING (true);
CREATE POLICY instructors_insert_own ON public.instructors
  FOR INSERT TO authenticated WITH CHECK (instructor_id = auth.uid());
CREATE POLICY instructors_update_own ON public.instructors
  FOR UPDATE TO authenticated USING (instructor_id = auth.uid());
CREATE POLICY instructors_delete_own ON public.instructors
  FOR DELETE TO authenticated USING (instructor_id = auth.uid());

CREATE POLICY courses_select_auth ON public.courses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY courses_insert_own ON public.courses
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY courses_update_own ON public.courses
  FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY courses_delete_own ON public.courses
  FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY stubcodes_select_auth ON public.stubcodes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY stubcodes_insert_own ON public.stubcodes
  FOR INSERT TO authenticated WITH CHECK (instructor_id = auth.uid());
CREATE POLICY stubcodes_update_own ON public.stubcodes
  FOR UPDATE TO authenticated USING (instructor_id = auth.uid());
CREATE POLICY stubcodes_delete_own ON public.stubcodes
  FOR DELETE TO authenticated USING (instructor_id = auth.uid());

CREATE POLICY stubcode_instructors_select_auth ON public.stubcode_instructors
  FOR SELECT TO authenticated USING (true);
CREATE POLICY stubcode_instructors_write_own ON public.stubcode_instructors
  FOR ALL TO authenticated
  USING (instructor_id = auth.uid())
  WITH CHECK (instructor_id = auth.uid());

CREATE POLICY enrollments_select_auth ON public.enrollments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY enrollments_write_own ON public.enrollments
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stubcodes s
    WHERE s.course_stubcode = enrollments.course_stubcode
      AND s.instructor_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stubcodes s
    WHERE s.course_stubcode = enrollments.course_stubcode
      AND s.instructor_id = auth.uid()));

CREATE POLICY schedules_select_auth ON public.stubcode_schedules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY schedules_write_own ON public.stubcode_schedules
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stubcodes s
    WHERE s.course_stubcode = stubcode_schedules.course_stubcode
      AND s.instructor_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stubcodes s
    WHERE s.course_stubcode = stubcode_schedules.course_stubcode
      AND s.instructor_id = auth.uid()));

CREATE POLICY class_sessions_select_auth ON public.class_sessions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY class_sessions_write_own ON public.class_sessions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stubcodes s
    WHERE s.course_stubcode = class_sessions.course_stubcode
      AND s.instructor_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stubcodes s
    WHERE s.course_stubcode = class_sessions.course_stubcode
      AND s.instructor_id = auth.uid()));

CREATE POLICY attendance_select_auth ON public.attendance
  FOR SELECT TO authenticated USING (true);
CREATE POLICY attendance_write_own ON public.attendance
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stubcodes s
    WHERE s.course_stubcode = attendance.course_stubcode
      AND s.instructor_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stubcodes s
    WHERE s.course_stubcode = attendance.course_stubcode
      AND s.instructor_id = auth.uid()));

CREATE POLICY devices_select_auth ON public.devices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY devices_write_auth ON public.devices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Read for authenticated, write only via service_role (Edge Functions).
CREATE POLICY students_select_auth ON public.students
  FOR SELECT TO authenticated USING (true);
CREATE POLICY student_cards_select_auth ON public.student_cards
  FOR SELECT TO authenticated USING (true);
CREATE POLICY room_modes_select_auth ON public.room_modes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY scan_logs_select_auth ON public.scan_logs
  FOR SELECT TO authenticated USING (true);

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.instructors, public.courses, public.students, public.student_cards,
  public.stubcodes, public.stubcode_instructors, public.enrollments,
  public.stubcode_schedules, public.class_sessions, public.room_modes,
  public.attendance, public.scan_logs, public.devices
TO authenticated;

GRANT ALL ON
  public.instructors, public.courses, public.students, public.student_cards,
  public.stubcodes, public.stubcode_instructors, public.enrollments,
  public.stubcode_schedules, public.class_sessions, public.room_modes,
  public.attendance, public.scan_logs, public.devices
TO service_role;

-- Signup trigger now writes to instructors instead of profiles. The trigger is
-- OID-based, so replacing the function body is enough; it is created here only
-- on a fresh project.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.instructors (instructor_id, first_name, last_name, school_id)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'school_id'
  )
  ON CONFLICT (instructor_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    EXECUTE 'CREATE TRIGGER on_auth_user_created
             AFTER INSERT ON auth.users
             FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()';
  END IF;
END $$;

-- Realtime for live roster/session updates.
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['enrollments', 'attendance', 'class_sessions'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;
