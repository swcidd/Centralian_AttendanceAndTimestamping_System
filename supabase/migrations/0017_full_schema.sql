-- =========================================================================================
-- 0017_full_schema.sql
-- New migration implementing the complete CATS database schema as specified.
-- DB is empty → all changes are lossless.
-- =========================================================================================

-- -- Enums
-- Creating enums as Postgres types. These are scoped to the database session
-- and do not conflict with application-level types.
--
CREATE TYPE course_type_enum       AS ENUM ('lect', 'lab');
CREATE TYPE instructor_role_enum   AS ENUM ('co', 'substitute');
CREATE TYPE room_mode_enum         AS ENUM ('enroll', 'attend');
CREATE TYPE attendance_status_enum AS ENUM ('present', 'late', 'absent', 'excused');
CREATE TYPE attendance_source_enum AS ENUM ('system', 'instructor');
CREATE TYPE scan_result_enum       AS ENUM ('ok', 'unknown_card', 'not_enrolled',
                                            'no_active_mode', 'duplicate', 'rejected');

-- ============================================================================================
-- courses
-- ============================================================================================
CREATE TABLE courses (
  course_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_type  course_type_enum NOT NULL,
  course_code  varchar NOT NULL,
  course_name  varchar NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courses_code_type_key UNIQUE (course_code, course_type)
);

-- ============================================================================================
-- instructors
-- instructor_id stays varchar = school_id / auth user identifier per ERD design.
-- ============================================================================================
CREATE TABLE instructors (
  instructor_id          varchar PRIMARY KEY,
  instructor_firstname   varchar NOT NULL,
  instructor_lastname    varchar NOT NULL,
  instructor_department  varchar,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================================
-- students
-- nfc_uid moved to student_cards (0011's design; ERD's int reconciled away).
-- ============================================================================================
CREATE TABLE students (
  student_id         varchar PRIMARY KEY,
  student_firstname  varchar NOT NULL,
  student_lastname   varchar NOT NULL,
  student_program    varchar,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================================
-- student_cards
-- reissuable card, one active per student; nfc_uid is the unique identifier.
-- ============================================================================================
CREATE TABLE student_cards (
  card_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  varchar NOT NULL
              REFERENCES students (student_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  nfc_uid     varchar NOT NULL,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  CONSTRAINT student_cards_nfc_uid_key UNIQUE (nfc_uid)
);
CREATE UNIQUE INDEX student_cards_one_active_idx
  ON student_cards (student_id) WHERE revoked_at IS NULL;

-- ============================================================================================
-- stubcodes
-- course_stubcode is the registrar's number, globally unique integer key.
-- instructor_id links to Instructors; ON DELETE RESTRICT preserves audit history.
-- ============================================================================================
CREATE TABLE stubcodes (
  course_stubcode  integer PRIMARY KEY,
  course_id        uuid NOT NULL
                   REFERENCES courses (course_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  instructor_id    varchar NOT NULL
                   REFERENCES instructors (instructor_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================================
-- stubcode_instructors (co-teachers / substitutes; owner stays on stubcodes)
-- Primary key is the composite (course_stubcode, instructor_id).
-- ============================================================================================
CREATE TABLE stubcode_instructors (
  course_stubcode  integer NOT NULL
                   REFERENCES stubcodes (course_stubcode) ON UPDATE CASCADE ON DELETE CASCADE,
  instructor_id    varchar NOT NULL
                   REFERENCES instructors (instructor_id) ON UPDATE CASCADE ON DELETE CASCADE,
  role             instructor_role_enum NOT NULL,
  PRIMARY KEY (course_stubcode, instructor_id)
);

-- ============================================================================================
-- enrollments (soft drop via dropped_at)
-- Unique constraints ensure one active enrollment per (stubcode, student).
-- ============================================================================================
CREATE TABLE enrollments (
  enrollment_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_stubcode  integer NOT NULL
                   REFERENCES stubcodes (course_stubcode) ON UPDATE CASCADE ON DELETE RESTRICT,
  student_id       varchar NOT NULL
                   REFERENCES students (student_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  enrolled_at      timestamptz NOT NULL DEFAULT now(),
  dropped_at       timestamptz,
  CONSTRAINT enrollments_stubcode_student_key UNIQUE (course_stubcode, student_id),
  CONSTRAINT enrollments_id_stubcode_key UNIQUE (enrollment_id, course_stubcode)
);

-- ============================================================================================
-- stubcode_schedule
-- schedule_day: 1 = Monday ... 7 = Sunday (ISO).
-- Thresholds are INT minutes relative to schedule_start, computed at runtime.
-- The unique constraint enforces one slot per (course_stubcode, day, start).
-- ============================================================================================
CREATE TABLE stubcode_schedule (
  stubcode_schedule_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_stubcode       integer NOT NULL
                        REFERENCES stubcodes (course_stubcode) ON UPDATE CASCADE ON DELETE RESTRICT,
  schedule_room         varchar NOT NULL,
  schedule_day          smallint NOT NULL,
  schedule_start        time NOT NULL,
  schedule_end          time NOT NULL,
  late_after_min        smallint NOT NULL DEFAULT 15,
  absent_after_min      smallint NOT NULL DEFAULT 30,
  CONSTRAINT stubcode_schedule_slot_key UNIQUE (course_stubcode, schedule_day, schedule_start),
  CONSTRAINT stubcode_schedule_id_stubcode_key UNIQUE (stubcode_schedule_id, course_stubcode),
  CONSTRAINT stubcode_schedule_day_chk CHECK (schedule_day BETWEEN 1 AND 7),
  CONSTRAINT stubcode_schedule_time_chk CHECK (
    schedule_end > schedule_start
    AND late_after_min > 0
    AND absent_after_min > late_after_min
    AND (schedule_end - schedule_start) >= make_interval(mins => absent_after_min)
  )
);

-- ============================================================================================
-- class_sessions
-- closed_at IS NULL means the session is open.
-- One row per (stubcode_schedule_id, session_date).
-- ============================================================================================
CREATE TABLE class_sessions (
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

-- ============================================================================================
-- room_modes
-- room is the PK, so a room has at most one active mode.
-- closing a mode = deleting the row.
-- DEFERRABLE INITIALLY DEFERRED FKs allow transactional consistency between
-- class_sessions and room_modes.
-- ============================================================================================
CREATE TABLE room_modes (
  room             varchar PRIMARY KEY,
  mode             room_mode_enum NOT NULL,
  course_stubcode  integer NOT NULL
                   REFERENCES stubcodes (course_stubcode) ON UPDATE CASCADE ON DELETE RESTRICT,
  session_id       uuid,
  opened_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_modes_session_fk
    FOREIGN KEY (session_id, course_stubcode)
    REFERENCES class_sessions (session_id, course_stubcode)
    ON UPDATE CASCADE ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT room_modes_mode_session_chk CHECK (
    (mode = 'enroll' AND session_id IS NULL)
    OR (mode = 'attend' AND session_id IS NOT NULL)
  )
);

-- ============================================================================================
-- attendance
-- rows are generated per session from enrollments; a tap UPDATEs.
-- DEFERRABLE INITIALLY DEFERRED FKs allow the two-path cascade (course_stubcode
-- reaches attendance through enrollments AND through class_sessions → stubcode_schedule).
-- ============================================================================================
CREATE TABLE attendance (
  attendance_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            uuid NOT NULL,
  enrollment_id         uuid NOT NULL,
  course_stubcode       integer NOT NULL,
  status                attendance_status_enum NOT NULL DEFAULT 'absent',
  attendance_timestamp  timestamptz,
  source                attendance_source_enum NOT NULL DEFAULT 'system',
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

-- ============================================================================================
-- scan_logs
-- append-only; deliberately NO foreign keys so unknown cards are logged.
-- ============================================================================================
CREATE TABLE scan_logs (
  scan_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scanned_at       timestamptz NOT NULL DEFAULT now(),
  room             varchar NOT NULL,
  nfc_uid          varchar NOT NULL,
  mode             room_mode_enum,
  result           scan_result_enum NOT NULL,
  student_id       varchar,
  course_stubcode  integer,
  session_id       uuid
);

-- ============================================================================================
-- Indexes (Postgres does not index FK columns automatically)
-- ============================================================================================
CREATE INDEX stubcodes_course_id_idx       ON stubcodes (course_id);
CREATE INDEX stubcodes_instructor_id_idx   ON stubcodes (instructor_id);
CREATE INDEX enrollments_student_id_idx    ON enrollments (student_id);
CREATE INDEX attendance_enrollment_id_idx  ON attendance (enrollment_id);
CREATE INDEX scan_logs_scanned_at_idx      ON scan_logs (scanned_at);

-- ============================================================================================
-- End of 0017_full_schema.sql
-- ============================================================================================