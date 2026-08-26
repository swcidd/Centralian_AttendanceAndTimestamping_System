-- ============================================================
-- 0011_student_id_as_school_id.sql
-- Change Students.Student_ID from auto-generated UUID to the
-- student-provided school_id (VARCHAR(50)). Drop the now-
-- redundant School_ID column.
-- ============================================================

-- 1. Drop FK constraints that reference the old UUID Student_ID
ALTER TABLE Enrollments
    DROP CONSTRAINT IF EXISTS enrollments_student_id_fkey;

ALTER TABLE Attendance_Logs
    DROP CONSTRAINT IF EXISTS attendance_logs_student_id_fkey;

-- 2. Alter Students.Student_ID from UUID to VARCHAR(50)
--    Cast existing UUIDs to text just in case there's test data.
ALTER TABLE Students
    ALTER COLUMN Student_ID DROP DEFAULT,
    ALTER COLUMN Student_ID TYPE VARCHAR(50) USING Student_ID::TEXT;

-- 3. Drop the redundant School_ID column (Student_ID IS school_id now)
ALTER TABLE Students
    DROP COLUMN IF EXISTS School_ID;

-- 4. Alter Enrollments.Student_ID to match
ALTER TABLE Enrollments
    ALTER COLUMN Student_ID TYPE VARCHAR(50) USING Student_ID::TEXT;

-- 5. Alter Attendance_Logs.Student_ID to match
ALTER TABLE Attendance_Logs
    ALTER COLUMN Student_ID TYPE VARCHAR(50) USING Student_ID::TEXT;

-- 6. Recreate FK constraints
ALTER TABLE Enrollments
    ADD CONSTRAINT enrollments_student_id_fkey
    FOREIGN KEY (Student_ID) REFERENCES Students(Student_ID) ON DELETE CASCADE;

ALTER TABLE Attendance_Logs
    ADD CONSTRAINT attendance_logs_student_id_fkey
    FOREIGN KEY (Student_ID) REFERENCES Students(Student_ID) ON DELETE CASCADE;
