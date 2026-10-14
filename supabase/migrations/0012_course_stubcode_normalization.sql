-- Normalize: a Course owns many Stubcodes. Courses.Stub_Code (the fused PK)
-- becomes its first Stubcodes row, and everything keyed by Stub_Code now
-- references Stubcodes. Inbound FKs are dropped before the PK swap.

ALTER TABLE Courses ADD COLUMN Course_ID UUID NOT NULL DEFAULT gen_random_uuid();

-- All inbound FKs target Courses(Stub_Code); their names were
-- Postgres-generated, so look them up rather than assume.
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

CREATE TABLE Stubcodes (
    Stub_Code  VARCHAR(20) PRIMARY KEY,
    Course_ID  UUID NOT NULL REFERENCES Courses(Course_ID) ON DELETE CASCADE,
    Created_At TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stubcodes_course ON Stubcodes (Course_ID);

INSERT INTO Stubcodes (Stub_Code, Course_ID)
SELECT Stub_Code, Course_ID FROM Courses;

-- Re-point the five FKs. Operational bookkeeping cascades with the stub;
-- Attendance_Logs keeps NO ACTION so real history blocks deletion.
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

GRANT SELECT, INSERT, UPDATE, DELETE ON Stubcodes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON Stubcodes TO service_role;

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

ALTER TABLE Courses DROP COLUMN Stub_Code;

-- One open session per device. Close pre-existing duplicates first so a
-- leftover orphan can't fail index creation.
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
