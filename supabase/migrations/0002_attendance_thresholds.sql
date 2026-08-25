-- ============================================================
-- 0002_attendance_thresholds.sql
-- Adds configurable late/absent thresholds per course and a
-- pg_cron job that auto-marks students absent once their
-- course's absent threshold has elapsed with no tap.
--
-- Write model:
--   PRESENT / LATE : written only by ingest-tap, at the moment
--                    of a real physical tap.
--   ABSENT         : written only by finalize_absences(), once,
--                    for every enrolled student with no row yet,
--                    once Started_At + Absent_After_Minutes passes.
-- No row is ever overwritten once it exists — the unique index
-- below is what makes that hold under a race between a tap and
-- the cron job landing at the same moment.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Configurable thresholds. NULL (the default) means "off" —
--    no LATE distinction and no auto-absent for that course
--    until the teacher sets a value.
-- ------------------------------------------------------------
ALTER TABLE Courses ADD COLUMN Late_After_Minutes   INT;
ALTER TABLE Courses ADD COLUMN Absent_After_Minutes INT;

-- ------------------------------------------------------------
-- 2. An ABSENT row has no physical tap behind it, so it has no
--    NFC_UID/Device_MAC to record. PRESENT/LATE/UNKNOWN rows
--    still require both, since those always come from a real tap.
-- ------------------------------------------------------------
ALTER TABLE Attendance_Logs ALTER COLUMN NFC_UID DROP NOT NULL;
ALTER TABLE Attendance_Logs ALTER COLUMN Device_MAC DROP NOT NULL;

ALTER TABLE Attendance_Logs ADD CONSTRAINT chk_absent_has_no_uid
    CHECK (Status = 'ABSENT' OR NFC_UID IS NOT NULL);

-- ------------------------------------------------------------
-- 3. One attendance row per student per session, enforced by
--    the database. This is what makes concurrent writes from
--    ingest-tap and finalize_absences() safe: whichever commits
--    first wins, the other is rejected/skipped — never both.
--    Partial (WHERE Student_ID IS NOT NULL) so unmatched/UNKNOWN
--    taps, which have no Student_ID, aren't constrained.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX idx_attendance_one_per_student_session
    ON Attendance_Logs (Session_ID, Student_ID)
    WHERE Student_ID IS NOT NULL;

-- ------------------------------------------------------------
-- 4. Bulk-marks absences for sessions that just crossed their
--    course's absent threshold, then closes those sessions so
--    they're never re-scanned by a later run. SECURITY DEFINER
--    since pg_cron invokes this as the Postgres role, not an
--    authenticated user — RLS would otherwise block the writes.
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
    JOIN Courses c ON c.Stub_Code = s.Stub_Code
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
-- 5. Run every minute. cron.schedule() updates the existing job
--    in place when one with this name already exists, so
--    re-running this migration is safe.
-- ------------------------------------------------------------
SELECT cron.schedule('finalize-absences', '* * * * *', 'SELECT public.finalize_absences();');
