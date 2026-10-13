-- ============================================================
-- 0013_cascade_attendance_on_stub_delete.sql
-- 0001/0008 deliberately left Attendance_Logs.Stub_Code as NO
-- ACTION so real attendance history blocked course deletion — the
-- app surfaced that as "This course has attendance records and
-- can't be deleted."
--
-- Product decision: deleting a stubcode or a course SHOULD be
-- possible even with history beneath it, provided the operator
-- confirms loudly first (the UI shows the exact record count).
-- ON DELETE CASCADE makes Postgres drop the attendance rows BEFORE
-- the parent stub/course row, atomically in the same transaction —
-- literally "drop the records first, then delete the course".
--
-- RLS note: a direct client DELETE on attendance_logs still removes
-- nothing (there is deliberately no DELETE policy — writes belong to
-- the ingest-tap edge function only). Referential-integrity cascades
-- run as the constraint owner and are not subject to that policy,
-- so only the parent-row deletion path purges history.
-- ============================================================

ALTER TABLE Attendance_Logs
    DROP CONSTRAINT attendance_logs_stub_code_fkey;

ALTER TABLE Attendance_Logs
    ADD CONSTRAINT attendance_logs_stub_code_fkey
        FOREIGN KEY (Stub_Code) REFERENCES Stubcodes(Stub_Code) ON DELETE CASCADE;
