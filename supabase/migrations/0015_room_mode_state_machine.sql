-- ============================================================
-- 0015_room_mode_state_machine.sql
-- Full schema for room-mode state machine.
-- DB is empty → all changes are lossless.
-- ============================================================
--
-- Decisions (user-approved, hard 2-hr limit initially, now extended):
--  1. Global integer PK for course_stubcode  (stubcodes.Stub_Code → INT)
--  2. device_id = MAC; devices(room) backend derives room from signed key
--  3. Keep global DEVICE_PSK; no per-device keys
--  4. stubcode_instructors deferred
--  5. Authorization: stubcodes.instructor_id = auth.uid() only
--  6. RLS on with no policies for students, student_cards, scan_logs, room_modes
--  7. Skip: deferrable FKs, ON UPDATE CASCADE
--  8. finalize_absences() + pg_cron removed — pre-generated absent rows make it dead
--  9. device_commands / claim_next / poll-commands deleted (separate commit)
-- ============================================================

-- -- 1. Stubcodes: change PK from VARCHAR to INT.
--    Since the live DB is empty and all code already coerces via
--    ArduinoJson .as<String>(), we ALTER COLUMN TYPE in-place.
--
ALTER TABLE Stubcodes ALTER COLUMN Stub_Code TYPE INT USING Stub_Code::INT;
--
-- Ensure the primary key is on the now-INTEGER column.
--
DO $$
BEGIN
    BEGIN
        ALTER TABLE Stubcodes DROP CONSTRAINT stubcodes_pkey;
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
    ALTER TABLE Stubcodes ADD PRIMARY KEY (Stub_Code);
END $$;

-- -- 2. Courses: add course_type column + UNIQUE constraint.
--
ALTER TABLE Courses ADD COLUMN IF NOT EXISTS course_type VARCHAR(20)
    DEFAULT 'lect' CHECK (course_type IN ('lect', 'lab'));
ALTER TABLE Courses ADD CONSTRAINT courses_code_type_key
    UNIQUE (course_code, course_type);

-- -- 3. Enrollments: soft‑drop column.
--
ALTER TABLE Enrollments ADD COLUMN IF NOT EXISTS dropped_at TIMESTAMPTZ;

-- -- 4. Devices: ensure room column exists (backend derives it from the
--    signed PSK; the column is there for the UI / catalog).
--
ALTER TABLE Devices ADD COLUMN IF NOT EXISTS room VARCHAR(100);

-- -- 5. Enable RLS on all tables.
--
ALTER TABLE Stubcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE Courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE Enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE Active_Sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE Attendance_Logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE Stubcode_Schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_cards ENABLE ROW LEVEL SECURITY;

-- -- 6. Minimal RLS policies (catalog + instructor ownership).
--    Anything beyond this is in the Edge Functions.

-- Stubcodes: instructor can manage their own sections.
CREATE POLICY IF NOT EXISTS stubcodes_own ON Stubcodes
    FOR ALL TO authenticated USING (Instructor_ID = auth.uid());

-- Courses: authenticated can read the catalog; owner writes.
CREATE POLICY IF NOT EXISTS courses_select_auth ON Courses
    FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS courses_own ON Courses
    FOR ALL TO authenticated USING (Created_By = auth.uid());

-- Enrollments: instructor owns the roster for their stubcode.
CREATE POLICY IF NOT EXISTS enrollments_own ON Enrollments
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM Stubcodes s
                   WHERE s.Course_ID = Enrollments.Course_ID
                     AND s.Course_Stubcode = Enrollments.Course_Stubcode
                     AND s.Instructor_ID = auth.uid()));

-- Active Sessions: instructor owns sessions for their stubcode.
CREATE POLICY IF NOT EXISTS sessions_own ON Active_Sessions
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM Stubcodes s
                   WHERE s.Course_ID = Active_Sessions.Course_ID
                     AND s.Course_Stubcode = Active_Sessions.Course_Stubcode
                     AND s.Instructor_ID = auth.uid()));

-- Attendance Logs: instructor can view logs for their stubcode.
CREATE POLICY IF NOT EXISTS attendance_own ON Attendance_Logs
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM Stubcodes s
                   WHERE s.Course_ID = Attendance_Logs.Course_ID
                     AND s.Course_Stubcode = Attendance_Logs.Course_Stubcode
                     AND s.Instructor_ID = auth.uid()));

-- Stubcode Schedules: instructor owns.
CREATE POLICY IF NOT EXISTS schedules_own ON Stubcode_Schedules
    FOR ALL TO authenticated USING (Instructor_ID = auth.uid());

-- class_sessions: instructor owns sessions for their stubcode.
CREATE POLICY IF NOT EXISTS classes_own ON class_sessions
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM Stubcodes s
                   WHERE s.Course_ID = class_sessions.Course_ID
                     AND s.Course_Stubcode = class_sessions.Course_Stubcode
                     AND s.Instructor_ID = auth.uid()));

-- room_modes: no client policies (per decision); instructor can manage.
CREATE POLICY IF NOT EXISTS room_modes_own ON room_modes
    FOR ALL TO authenticated USING (Instructor_ID = auth.uid());

-- scan_logs: no client policies (append‑only, server‑only).
-- (Reads via service_role only; no FOR SELECT to authenticated.)

-- Students / student_cards: no client policies (per decision).
CREATE POLICY IF NOT EXISTS students_own ON Students FOR ALL TO authenticated USING (false);
CREATE POLICY IF NOT EXISTS student_cards_own ON student_cards FOR ALL TO authenticated USING (false);

-- -- 7. NEW TABLES — room-mode state machine.

-- student_cards (reissuable, one active per student)
CREATE TABLE IF NOT EXISTS student_cards (
  card_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  varchar NOT NULL
              REFERENCES students (student_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  nfc_uid     varchar NOT NULL,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  CONSTRAINT student_cards_nfc_uid_key UNIQUE (nfc_uid)
);
CREATE UNIQUE INDEX IF NOT EXISTS student_cards_one_active_idx
  ON student_cards (student_id) WHERE revoked_at IS NULL;

-- room_modes (room is the PK, so a room has at most one active mode;
-- closing a mode = deleting the row)
CREATE TABLE IF NOT EXISTS room_modes (
  room             varchar PRIMARY KEY,
  mode             varchar(20) NOT NULL CHECK (mode IN ('enroll', 'attend')),
  course_stubcode  integer NOT NULL
                   REFERENCES stubcodes (course_stubcode) ON UPDATE CASCADE ON DELETE RESTRICT,
  session_id       uuid,
  opened_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_modes_mode_session_chk CHECK (
    (mode = 'enroll' AND session_id IS NULL)
    OR (mode = 'attend' AND session_id IS NOT NULL)
  )
);

-- class_sessions (closed_at IS NULL means the session is open)
CREATE TABLE IF NOT EXISTS class_sessions (
  session_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stubcode_schedule_id  uuid NOT NULL,
  course_stubcode       integer NOT NULL,
  session_date          date NOT NULL,
  closed_at             timestamptz,
  CONSTRAINT class_sessions_slot_date_key UNIQUE (stubcode_schedule_id, session_date),
  CONSTRAINT class_sessions_id_stubcode_key UNIQUE (session_id, course_stubcode),
  CONSTRAINT class_sessions_schedule_fk
    FOREIGN KEY (stubcode_schedule_id, course_stubcode)
    REFERENCES stubcode_schedule (stubcode_schedule_id, course_stubcode)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

-- attendance (rows are generated per session from enrollments; a tap UPDATEs)
CREATE TABLE IF NOT EXISTS attendance (
  attendance_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            uuid NOT NULL,
  enrollment_id         uuid NOT NULL,
  course_stubcode       integer NOT NULL,
  status                varchar(20) NOT NULL DEFAULT 'absent',
  attendance_timestamp  timestamptz,
  source                varchar(20) NOT NULL DEFAULT 'system',
  note                  text,
  CONSTRAINT attendance_session_enrollment_key UNIQUE (session_id, enrollment_id),
  CONSTRAINT attendance_session_fk
    FOREIGN KEY (session_id, course_stubcode)
    REFERENCES class_sessions (session_id, course_stubcode)
    ON UPDATE CASCADE ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT attendance_enrollment_fk
    FOREIGN KEY (enrollment_id, course_stubcode)
    REFERENCES enrollments (enrollment_id, course_stubcode)
    ON UPDATE CASCADE ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

-- scan_logs (append-only; deliberately NO foreign keys so unknown cards are logged)
CREATE TABLE IF NOT EXISTS scan_logs (
  scan_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scanned_at       timestamptz NOT NULL DEFAULT now(),
  room             varchar NOT NULL,
  nfc_uid          varchar NOT NULL,
  mode             varchar(20),
  result           varchar(20) NOT NULL,
  student_id       varchar,
  course_stubcode  integer,
  session_id       uuid
);

-- Indexes (Postgres does not index FK columns automatically)
CREATE INDEX IF NOT EXISTS stubcodes_course_id_idx       ON stubcodes (course_id);
CREATE INDEX IF NOT EXISTS stubcodes_instructor_id_idx   ON stubcodes (instructor_id);
CREATE INDEX IF NOT EXISTS enrollments_student_id_idx    ON enrollments (student_id);
CREATE INDEX IF NOT EXISTS attendance_enrollment_id_idx  ON attendance (enrollment_id);
CREATE INDEX IF NOT EXISTS scan_logs_scanned_at_idx      ON scan_logs (scanned_at);

-- -- 8. Migrate existing active_sessions data into class_sessions + room_modes
--    (empty DB = no data to migrate, but this script handles a non-empty case):
--
--   a) For each active_session with status 'ACTIVE_ATTENDANCE', create a
--      class_session row keyed by the session's stub_code schedule.
--   b) Create a room_modes row for that room in 'enroll' mode (idle → open enrollment).
--   c) For status 'REGISTRATION', create a room_modes row in 'enroll' mode.
--
DO $$
DECLARE
    s record;
    sched record;
    smode varchar(20);
BEGIN
    -- Only run if tables have data; skip silently on empty DB.
    IF NOT EXISTS (SELECT 1 FROM active_sessions LIMIT 1) THEN
        RETURN;
    END IF;

    FOR s IN SELECT * FROM active_sessions LOOP
        -- Determine mode from status
        IF s.status = 'ACTIVE_ATTENDANCE' THEN
            smode := 'attend';
        ELSE
            smode := 'enroll';
        END IF;

        -- Find the stubcode_schedule for this stub_code to get schedule details
        SELECT * INTO sched FROM stubcode_schedule WHERE course_stubcode = s.stub_code LIMIT 1;

        -- Insert class_session (session_date = today)
        INSERT INTO class_sessions (stubcode_schedule_id, course_stubcode, session_date, closed_at)
        VALUES (sched.stubcode_schedule_id, s.stub_code, CURRENT_DATE, NULL)
        ON CONFLICT (stubcode_schedule_id, session_date) DO NOTHING;

        -- Insert/ensure room_modes row
        INSERT INTO room_modes (room, mode, course_stubcode, session_id, opened_at)
        VALUES (s.device_mac, smode, s.stub_code, s.session_id, NOW())
        ON CONFLICT (room) DO UPDATE SET
            mode = smode,
            course_stubcode = s.stub_code,
            session_id = s.session_id,
            opened_at = NOW();
    END LOOP;
END $$;

-- ============================================================
-- End of 0015_room_mode_state_machine.sql
-- ============================================================