-- Students.Student_ID becomes the student-provided school_id (VARCHAR(50));
-- the redundant School_ID column is dropped. Existing UUIDs are cast to text
-- in case of test data.

ALTER TABLE Enrollments
    DROP CONSTRAINT IF EXISTS enrollments_student_id_fkey;

ALTER TABLE Attendance_Logs
    DROP CONSTRAINT IF EXISTS attendance_logs_student_id_fkey;

ALTER TABLE Students
    ALTER COLUMN Student_ID DROP DEFAULT,
    ALTER COLUMN Student_ID TYPE VARCHAR(50) USING Student_ID::TEXT;

ALTER TABLE Students
    DROP COLUMN IF EXISTS School_ID;

ALTER TABLE Enrollments
    ALTER COLUMN Student_ID TYPE VARCHAR(50) USING Student_ID::TEXT;

ALTER TABLE Attendance_Logs
    ALTER COLUMN Student_ID TYPE VARCHAR(50) USING Student_ID::TEXT;

ALTER TABLE Enrollments
    ADD CONSTRAINT enrollments_student_id_fkey
    FOREIGN KEY (Student_ID) REFERENCES Students(Student_ID) ON DELETE CASCADE;

ALTER TABLE Attendance_Logs
    ADD CONSTRAINT attendance_logs_student_id_fkey
    FOREIGN KEY (Student_ID) REFERENCES Students(Student_ID) ON DELETE CASCADE;
