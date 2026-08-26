-- ============================================================
-- 0008_course_visibility_and_delete.sql
-- Two fixes for the Courses page:
--
-- 1. Courses were visible to every authenticated teacher regardless
--    of who created them (courses_select_authenticated USING true).
--    Restricts SELECT to the owning instructor, matching the INSERT/
--    UPDATE/DELETE policies that already require Instructor_ID =
--    auth.uid(). A course with a NULL Instructor_ID (only possible
--    if the original instructor's account was deleted, via ON DELETE
--    SET NULL) becomes invisible to everyone — acceptable, since
--    nothing currently reassigns orphaned courses.
--
-- 2. Deleting a course failed outright whenever it had any
--    Active_Sessions or Device_Commands rows — those FKs had no
--    ON DELETE behavior specified in 0001, defaulting to RESTRICT.
--    Both are operational bookkeeping (a gating window, a command
--    mailbox), not durable history, so they're safe to cascade.
--    Attendance_Logs stays RESTRICT deliberately — that's the actual
--    audit trail this schema goes out of its way elsewhere to
--    describe as append-only and never overwritten, so a course with
--    real attendance history still can't be deleted; the app surfaces
--    that as a clear error instead of silently destroying records.
--
--    The original FK constraints were created inline with no explicit
--    name, so Postgres auto-generated one — looked up dynamically
--    here via pg_constraint rather than assumed, since a wrong
--    hardcoded guess would just fail this migration outright.
-- ============================================================

DROP POLICY "courses_select_authenticated" ON Courses;
CREATE POLICY "courses_select_own" ON Courses
    FOR SELECT TO authenticated USING (Instructor_ID = auth.uid());

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
