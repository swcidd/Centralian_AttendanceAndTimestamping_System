-- ============================================================
-- 0012_course_stubcode_normalization.sql
-- ER-model normalization: a Course owns many Stubcodes and a
-- Stubcode belongs to exactly one Course. Previously the two were
-- fused — Courses.Stub_Code was the primary key, so a course could
-- hold at most one stub code:
--
--   Professor  1:N  Course      (Courses.Instructor_ID, unchanged)
--   Course     1:N  Stubcodes   (new Stubcodes.Course_ID)
--   Stubcode   N:1  Course      (by construction)
--
-- Everything keyed by Stub_Code (Enrollments, Active_Sessions,
-- Attendance_Logs, Device_Commands, Pending_Registrations) now
-- references Stubcodes(Stub_Code) instead of Courses(Stub_Code).
-- Existing rows keep their codes verbatim — each course's current
-- code is migrated as its first Stubcodes row — so live FK values,
-- the edge functions' payloads, and realtime filters are unaffected.
--
-- Also adds a one-open-session-per-DEVICE guarantee: several
-- stubcodes of one course share that course's single terminal, so
-- closing stale sessions per stub alone could leave two open rows on
-- one device, which ingest-tap's .maybeSingle() rejects as an error.
--
-- Ordering matters: the inbound FKs depend on the old primary key,
-- so they are dropped BEFORE the PK swap, and Stubcodes must exist
-- before the FKs are re-pointed at it.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Surrogate key column on Courses. gen_random_uuid() default
--    stays so app inserts (createCourse) don't have to supply it.
-- ------------------------------------------------------------
ALTER TABLE Courses ADD COLUMN Course_ID UUID NOT NULL DEFAULT gen_random_uuid();

-- ------------------------------------------------------------
-- 2. Drop every FK that targeted Courses(Stub_Code). All inbound
--    FKs to Courses reference Stub_Code (Courses has no other
--    historically referenced column) and Stubcodes doesn't exist
--    yet at this point, so dropping by lookup is safe; constraint
--    names for the inline FKs were Postgres-generated, hence the
--    dynamic lookup (same approach as migration 0008).
-- ------------------------------------------------------------
DO $$
DECLARE
    fk record;
BEGIN
    FOR fk IN
        SELECT conrelid, conname
        FROM pg_constraint
        WHERE confrelid = 'courses'::regclass
          AND contype = 'f'
    LOOP
        EXECUTE format(
            'ALTER TABLE %I DROP CONSTRAINT %I',
            fk.conrelid::regclass::text,
            fk.conname
        );
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 3. Swap the primary key from Stub_Code to Course_ID.
-- ------------------------------------------------------------
DO $$
DECLARE
    pk_name text;
BEGIN
    SELECT conname INTO pk_name
    FROM pg_constraint
    WHERE conrelid = 'courses'::regclass
      AND contype = 'p';
    IF pk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE Courses DROP CONSTRAINT %I', pk_name);
    END IF;
END $$;

ALTER TABLE Courses ADD PRIMARY KEY (Course_ID);

-- ------------------------------------------------------------
-- 4. Stubcodes table + migration of each course's existing code.
--    The Course_ID index supports the courses->stubcodes embed in
--    fetchCourses and the ownership RLS joins below.
-- ------------------------------------------------------------
CREATE TABLE Stubcodes (
    Stub_Code  VARCHAR(20) PRIMARY KEY,
    Course_ID  UUID NOT NULL REFERENCES Courses(Course_ID) ON DELETE CASCADE,
    Created_At TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stubcodes_course ON Stubcodes (Course_ID);

INSERT INTO Stubcodes (Stub_Code, Course_ID)
SELECT Stub_Code, Course_ID FROM Courses;

-- ------------------------------------------------------------
-- 5. Re-point the five FKs at Stubcodes. Deletion semantics are
--    preserved per table: operational bookkeeping (sessions,
--    commands, registrations, enrollments) cascades with the stub;
--    Attendance_Logs keeps the default NO ACTION so real history
--    still blocks deletion, matching 0008's intent.
-- ------------------------------------------------------------
ALTER TABLE Enrollments
    ADD CONSTRAINT enrollments_stub_code_fkey
        FOREIGN KEY (Stub_Code) REFERENCES Stubcodes(Stub_Code) ON DELETE CASCADE;
ALTER TABLE Active_Sessions
    ADD CONSTRAINT active_sessions_stub_code_fkey
        FOREIGN KEY (Stub_Code) REFERENCES Stubcodes(Stub_Code) ON DELETE CASCADE;
ALTER TABLE Device_Commands
    ADD CONSTRAINT device_commands_stub_code_fkey
        FOREIGN KEY (Stub_Code) REFERENCES Stubcodes(Stub_Code) ON DELETE CASCADE;
ALTER TABLE Pending_Registrations
    ADD CONSTRAINT pending_registrations_stub_code_fkey
        FOREIGN KEY (Stub_Code) REFERENCES Stubcodes(Stub_Code) ON DELETE CASCADE;
ALTER TABLE Attendance_Logs
    ADD CONSTRAINT attendance_logs_stub_code_fkey
        FOREIGN KEY (Stub_Code) REFERENCES Stubcodes(Stub_Code);

-- ------------------------------------------------------------
-- 6. Enrollments ownership policies: same rule as before (only the
--    course's instructor may manage its roster), now resolved
--    through the Stubcodes -> Courses join.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "enrollments_insert_own_course" ON Enrollments;
DROP POLICY IF EXISTS "enrollments_delete_own_course" ON Enrollments;

CREATE POLICY "enrollments_insert_own_course" ON Enrollments
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM Stubcodes st
                JOIN Courses c ON c.Course_ID = st.Course_ID
                WHERE st.Stub_Code = Enrollments.Stub_Code
                  AND c.Instructor_ID = auth.uid())
    );
CREATE POLICY "enrollments_delete_own_course" ON Enrollments
    FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM Stubcodes st
                JOIN Courses c ON c.Course_ID = st.Course_ID
                WHERE st.Stub_Code = Enrollments.Stub_Code
                  AND c.Instructor_ID = auth.uid())
    );

-- ------------------------------------------------------------
-- 7. Stubcodes RLS: mirror the Courses rules from 0008 — instructors
--    see and manage only the stubcodes of courses they own.
-- ------------------------------------------------------------
ALTER TABLE Stubcodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stubcodes_select_own" ON Stubcodes
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM Courses c
                WHERE c.Course_ID = Stubcodes.Course_ID
                  AND c.Instructor_ID = auth.uid())
    );
CREATE POLICY "stubcodes_insert_own" ON Stubcodes
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM Courses c
                WHERE c.Course_ID = Stubcodes.Course_ID
                  AND c.Instructor_ID = auth.uid())
    );
CREATE POLICY "stubcodes_update_own" ON Stubcodes
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM Courses c
                WHERE c.Course_ID = Stubcodes.Course_ID
                  AND c.Instructor_ID = auth.uid())
    );
CREATE POLICY "stubcodes_delete_own" ON Stubcodes
    FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM Courses c
                WHERE c.Course_ID = Stubcodes.Course_ID
                  AND c.Instructor_ID = auth.uid())
    );

-- Base grants (0004/0007 pattern) — explicit rather than relying on
-- default privileges being in effect for the role that runs this.
GRANT SELECT, INSERT, UPDATE, DELETE ON Stubcodes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON Stubcodes TO service_role;

-- ------------------------------------------------------------
-- 8. finalize_absences(): the threshold lookup joined sessions to
--    courses directly on Stub_Code; route it through Stubcodes.
--    (CREATE OR REPLACE is idempotent — 0002/0006 both define it.)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_absences()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    due_ids UUID[];
BEGIN
    SELECT ARRAY_AGG(s.Session_ID) INTO due_ids
    FROM Active_Sessions s
    JOIN Stubcodes st ON st.Stub_Code = s.Stub_Code
    JOIN Courses c ON c.Course_ID = st.Course_ID
    WHERE s.Status = 'ACTIVE_ATTENDANCE'
      AND c.Absent_After_Minutes IS NOT NULL
      AND NOW() >= s.Started_At + make_interval(mins => c.Absent_After_Minutes);

    IF due_ids IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO Attendance_Logs (Session_ID, Student_ID, Stub_Code, Status, Timestamp)
    SELECT s.Session_ID, e.Student_ID, s.Stub_Code, 'ABSENT', NOW()
    FROM Active_Sessions s
    JOIN Enrollments e ON e.Stub_Code = s.Stub_Code
    WHERE s.Session_ID = ANY(due_ids)
    ON CONFLICT (Session_ID, Student_ID) WHERE Student_ID IS NOT NULL DO NOTHING;

    UPDATE Active_Sessions
    SET Status = 'CLOSED'
    WHERE Session_ID = ANY(due_ids);
END;
$$;

-- ------------------------------------------------------------
-- 9. Drop the fused column — stub codes now live only in Stubcodes.
-- ------------------------------------------------------------
ALTER TABLE Courses DROP COLUMN Stub_Code;

-- ------------------------------------------------------------
-- 10. One open session per device. First close any pre-existing
--     duplicate (all but the newest open row per device — the same
--     stale-close startSession() performs at runtime) so a leftover
--     orphan can't fail index creation. The per-stub guarantee from
--     0009 remains in place alongside this.
-- ------------------------------------------------------------
WITH ranked AS (
    SELECT Session_ID,
           ROW_NUMBER() OVER (
               PARTITION BY Device_MAC ORDER BY Started_At DESC
           ) AS rn
    FROM Active_Sessions
    WHERE Status <> 'CLOSED'
)
UPDATE Active_Sessions
SET Status = 'CLOSED'
WHERE Session_ID IN (SELECT Session_ID FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX idx_active_sessions_one_open_per_device
    ON Active_Sessions (Device_MAC)
    WHERE Status <> 'CLOSED';
