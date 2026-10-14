-- 1. Restrict Courses SELECT to the owning instructor (matching the write
--    policies). A course with NULL Instructor_ID becomes invisible, which is
--    acceptable — nothing reassigns orphaned courses.
DROP POLICY "courses_select_authenticated" ON Courses;
CREATE POLICY "courses_select_own" ON Courses
    FOR SELECT TO authenticated USING (Instructor_ID = auth.uid());

-- 2. Cascade Active_Sessions / Device_Commands when a course is deleted.
--    Attendance_Logs stays RESTRICT: it is the audit trail. The original FKs
--    were created inline, so their names are looked up rather than assumed.
DO $$
DECLARE
    existing_constraint text;
BEGIN
    SELECT conname INTO existing_constraint
    FROM pg_constraint
    WHERE conrelid = 'active_sessions'::regclass
      AND confrelid = 'courses'::regclass
      AND contype = 'f';
    EXECUTE format('ALTER TABLE Active_Sessions DROP CONSTRAINT %I', existing_constraint);

    SELECT conname INTO existing_constraint
    FROM pg_constraint
    WHERE conrelid = 'device_commands'::regclass
      AND confrelid = 'courses'::regclass
      AND contype = 'f';
    EXECUTE format('ALTER TABLE Device_Commands DROP CONSTRAINT %I', existing_constraint);
END $$;

ALTER TABLE Active_Sessions
    ADD CONSTRAINT active_sessions_stub_code_fkey
        FOREIGN KEY (Stub_Code) REFERENCES Courses(Stub_Code) ON DELETE CASCADE;

ALTER TABLE Device_Commands
    ADD CONSTRAINT device_commands_stub_code_fkey
        FOREIGN KEY (Stub_Code) REFERENCES Courses(Stub_Code) ON DELETE CASCADE;
