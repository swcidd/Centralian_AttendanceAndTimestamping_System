-- ============================================================
-- 0006_catch_up_partial_apply.sql
-- The remote database has migration 0001 applied but 0002–0005
-- were never recorded as applied (migration tracking table
-- has no rows for them), even though 0002 was partially
-- applied manually — Late_After_Minutes already exists.
--
-- This migration idempotently applies everything from 0002–0005
-- that may be missing, using IF NOT EXISTS / OR REPLACE / IF EXISTS
-- so it's safe to run on any state of the remote DB.
-- ============================================================

-- ==================== From 0002 ====================

-- 1. Threshold columns (Late_After_Minutes may already exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'courses' AND column_name = 'absent_after_minutes'
    ) THEN
        ALTER TABLE Courses ADD COLUMN Absent_After_Minutes INT;
    END IF;
END $$;

-- 2. Make NFC_UID/Device_MAC nullable for ABSENT rows
ALTER TABLE Attendance_Logs ALTER COLUMN NFC_UID DROP NOT NULL;
ALTER TABLE Attendance_Logs ALTER COLUMN Device_MAC DROP NOT NULL;

-- 3. Check constraint: ABSENT rows have no UID, all others must
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_absent_has_no_uid'
    ) THEN
        ALTER TABLE Attendance_Logs ADD CONSTRAINT chk_absent_has_no_uid
            CHECK (Status = 'ABSENT' OR NFC_UID IS NOT NULL);
    END IF;
END $$;

-- 4. Partial unique index: one attendance row per student per session
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_attendance_one_per_student_session'
    ) THEN
        CREATE UNIQUE INDEX idx_attendance_one_per_student_session
            ON Attendance_Logs (Session_ID, Student_ID)
            WHERE Student_ID IS NOT NULL;
    END IF;
END $$;

-- 5. finalize_absences() function (CREATE OR REPLACE is idempotent)
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

-- 6. pg_cron extension + schedule
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
SELECT cron.schedule('finalize-absences', '* * * * *', 'SELECT public.finalize_absences();');

-- ==================== From 0003 ====================

-- Drop columns that may or may not exist
ALTER TABLE Students DROP COLUMN IF EXISTS Course_Program;
ALTER TABLE Students DROP COLUMN IF EXISTS Year_Level;
ALTER TABLE Active_Sessions DROP COLUMN IF EXISTS Expires_At;

-- ==================== From 0004 ====================

-- Grants to authenticated role (safe to re-run)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- ==================== From 0005 ====================

-- claim_next_device_command() function (CREATE OR REPLACE is idempotent)
CREATE OR REPLACE FUNCTION public.claim_next_device_command(p_device_mac VARCHAR(50))
RETURNS TABLE (command_id UUID, stub_code VARCHAR(20), command_type VARCHAR(30))
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH claimed AS (
        SELECT dc.Command_ID
        FROM Device_Commands dc
        WHERE dc.Device_MAC = p_device_mac
          AND dc.Status = 'PENDING'
        ORDER BY dc.Created_At ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    UPDATE Device_Commands
    SET Status = 'ACKNOWLEDGED', Acknowledged_At = NOW()
    FROM claimed
    WHERE Device_Commands.Command_ID = claimed.Command_ID
    RETURNING Device_Commands.Command_ID, Device_Commands.Stub_Code, Device_Commands.Command_Type;
END;
$$;
