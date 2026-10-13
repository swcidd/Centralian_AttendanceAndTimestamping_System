-- PRESENT/LATE are written only by ingest-tap at tap time; ABSENT only by
-- finalize_absences(). No row is ever overwritten.

-- Configurable thresholds; NULL (default) means "off".
ALTER TABLE Courses ADD COLUMN Late_After_Minutes   INT;
ALTER TABLE Courses ADD COLUMN Absent_After_Minutes INT;

-- ABSENT rows have no physical tap, so no NFC_UID/Device_MAC.
ALTER TABLE Attendance_Logs ALTER COLUMN NFC_UID DROP NOT NULL;
ALTER TABLE Attendance_Logs ALTER COLUMN Device_MAC DROP NOT NULL;

ALTER TABLE Attendance_Logs ADD CONSTRAINT chk_absent_has_no_uid
    CHECK (Status = 'ABSENT' OR NFC_UID IS NOT NULL);

-- One row per student per session; makes concurrent ingest-tap /
-- finalize_absences() writes safe. Partial so UNKNOWN taps are exempt.
CREATE UNIQUE INDEX idx_attendance_one_per_student_session
    ON Attendance_Logs (Session_ID, Student_ID)
    WHERE Student_ID IS NOT NULL;

-- SECURITY DEFINER because pg_cron runs this as the Postgres role.
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

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.schedule('finalize-absences', '* * * * *', 'SELECT public.finalize_absences();');
