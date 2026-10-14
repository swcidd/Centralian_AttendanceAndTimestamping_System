-- Product decision: deleting a stubcode/course should work even with
-- attendance history beneath it (the UI confirms the exact record count
-- first). ON DELETE CASCADE drops the attendance rows with the parent.
-- Client DELETEs still remove nothing — there is no DELETE policy on
-- Attendance_Logs; cascades run as the constraint owner.
ALTER TABLE Attendance_Logs
    DROP CONSTRAINT attendance_logs_stub_code_fkey;

ALTER TABLE Attendance_Logs
    ADD CONSTRAINT attendance_logs_stub_code_fkey
        FOREIGN KEY (Stub_Code) REFERENCES Stubcodes(Stub_Code) ON DELETE CASCADE;
