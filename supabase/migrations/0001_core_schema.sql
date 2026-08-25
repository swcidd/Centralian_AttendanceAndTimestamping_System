-- ============================================================
-- NFCPass MVP Schema — 0001_core_schema.sql
-- Applies to: Supabase (PostgreSQL)
-- Naming: PascalCase tables/columns (matches existing frontend code)
-- Run in: Supabase Dashboard → SQL Editor (or `supabase db push`)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Instructor profiles, keyed 1:1 to Supabase Auth users.
--    Passwords live in auth.users; this table holds teacher data.
--    Profile_ID IS the auth.users id (no separate surrogate key),
--    so ownership policies below can compare directly against
--    auth.uid() instead of joining through a second UUID column.
-- ------------------------------------------------------------
CREATE TABLE Profiles (
    Profile_ID   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    First_Name   VARCHAR(100) NOT NULL,
    Last_Name    VARCHAR(100) NOT NULL,
    School_ID    VARCHAR(50) UNIQUE NOT NULL,
    Created_At   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. Physical ESP32 terminals
-- ------------------------------------------------------------
CREATE TABLE Devices (
    Device_MAC VARCHAR(50) PRIMARY KEY,
    Room_Name  VARCHAR(100) NOT NULL,
    Status     VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | OFFLINE | MAINTENANCE
    Created_At TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 3. Students — rows are created only at card-bind time during a
--    REGISTRATION session, so NFC_UID is always present (no orphans).
--    Only School_ID/First_Name/Last_Name are ever collected from a
--    student; NFC_UID is bound automatically from the tap itself.
-- ------------------------------------------------------------
CREATE TABLE Students (
    Student_ID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    School_ID  VARCHAR(50) UNIQUE NOT NULL,
    First_Name VARCHAR(100) NOT NULL,
    Last_Name  VARCHAR(100) NOT NULL,
    NFC_UID    VARCHAR(100) UNIQUE NOT NULL,
    Created_At TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 4. Class offerings; the owning teacher manages each course
-- ------------------------------------------------------------
CREATE TABLE Courses (
    Stub_Code     VARCHAR(20) PRIMARY KEY,
    Subject_Code  VARCHAR(50) NOT NULL,
    Course_Name   VARCHAR(255) NOT NULL,
    Instructor_ID UUID REFERENCES Profiles(Profile_ID) ON DELETE SET NULL,
    Device_MAC    VARCHAR(50) REFERENCES Devices(Device_MAC),
    Start_Time    TIME NOT NULL,
    End_Time      TIME NOT NULL,
    Days_Of_Week  VARCHAR(50) NOT NULL, -- e.g. 'MWF' or 'TThSat'
    Created_At    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 5. Class masterlist (roster); one enrollment per student per course
-- ------------------------------------------------------------
CREATE TABLE Enrollments (
    Enrollment_ID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    Stub_Code     VARCHAR(20) NOT NULL REFERENCES Courses(Stub_Code) ON DELETE CASCADE,
    Student_ID    UUID NOT NULL REFERENCES Students(Student_ID) ON DELETE CASCADE,
    Enrolled_At   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (Stub_Code, Student_ID)
);

-- ------------------------------------------------------------
-- 6. Gated windows opened by a teacher from the dashboard.
--    ACTIVE_ATTENDANCE = taps count as attendance.
--    REGISTRATION      = taps bind Pending_Registrations to new Students.
-- ------------------------------------------------------------
CREATE TABLE Active_Sessions (
    Session_ID  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    Stub_Code   VARCHAR(20) NOT NULL REFERENCES Courses(Stub_Code),
    Device_MAC  VARCHAR(50) NOT NULL REFERENCES Devices(Device_MAC),
    Status      VARCHAR(30) NOT NULL DEFAULT 'ACTIVE_ATTENDANCE', -- ACTIVE_ATTENDANCE | REGISTRATION | CLOSED
    Started_At  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    Created_By  UUID REFERENCES Profiles(Profile_ID)
);

-- ------------------------------------------------------------
-- 7. Append-only attendance records; raw NFC_UID kept for audit.
--    Student_ID is NULL with Status 'UNKNOWN' when an unregistered
--    card taps — logged for audit without inventing a student row.
--    Inserts happen ONLY via the ingest-tap Edge Function
--    (service role bypasses RLS); clients get read-only access.
-- ------------------------------------------------------------
CREATE TABLE Attendance_Logs (
    Log_ID     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    Session_ID UUID NOT NULL REFERENCES Active_Sessions(Session_ID) ON DELETE CASCADE,
    Student_ID UUID REFERENCES Students(Student_ID) ON DELETE CASCADE,
    Stub_Code  VARCHAR(20) NOT NULL REFERENCES Courses(Stub_Code),
    NFC_UID    VARCHAR(100) NOT NULL,
    Device_MAC VARCHAR(50) NOT NULL,
    Status     VARCHAR(20) NOT NULL DEFAULT 'PRESENT', -- PRESENT | LATE | UNKNOWN
    Timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 8. Dashboard -> device command mailbox. The ESP32 polls for
--    PENDING commands every ~5s and ACKs them via the Edge Function.
--    Clients may create commands; ACK updates are service-role only.
-- ------------------------------------------------------------
CREATE TABLE Device_Commands (
    Command_ID      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    Device_MAC      VARCHAR(50) NOT NULL REFERENCES Devices(Device_MAC) ON DELETE CASCADE,
    Stub_Code       VARCHAR(20) REFERENCES Courses(Stub_Code), -- context payload for the command
    Command_Type    VARCHAR(30) NOT NULL,                      -- START_REGISTRATION | START_ATTENDANCE | END_SESSION
    Status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',    -- PENDING | ACKNOWLEDGED
    Created_At      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    Acknowledged_At TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- 9. Self-entered student info waiting for a card tap to bind.
--    On tap during REGISTRATION, the Edge Function takes the oldest
--    PENDING row for that device+stub_code, creates the Student,
--    enrolls them, and marks this row BOUND.
-- ------------------------------------------------------------
CREATE TABLE Pending_Registrations (
    Registration_ID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    Stub_Code       VARCHAR(20) NOT NULL REFERENCES Courses(Stub_Code) ON DELETE CASCADE,
    Device_MAC      VARCHAR(50) NOT NULL REFERENCES Devices(Device_MAC),
    School_ID       VARCHAR(50) NOT NULL,
    First_Name      VARCHAR(100) NOT NULL,
    Last_Name       VARCHAR(100) NOT NULL,
    Status          VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | BOUND
    Created_At      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes (hot paths: dashboard reads + ESP32 polls)
-- ============================================================
CREATE INDEX idx_attendance_stub_time   ON Attendance_Logs (Stub_Code, Timestamp DESC);
CREATE INDEX idx_attendance_session     ON Attendance_Logs (Session_ID);
CREATE INDEX idx_device_commands_poll   ON Device_Commands (Status, Device_MAC);
CREATE INDEX idx_pending_reg_poll       ON Pending_Registrations (Status, Device_MAC);
CREATE INDEX idx_active_sessions_device ON Active_Sessions (Device_MAC, Status);
CREATE INDEX idx_enrollments_student    ON Enrollments (Student_ID);

-- ============================================================
-- Signup trigger: auto-create a Profiles row whenever a teacher
-- signs up. Expects Supabase Auth signUp() metadata:
--   { first_name, last_name, school_id }
-- SECURITY DEFINER so the insert into public.Profiles is allowed
-- even though no session/RLS context exists mid-signup.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.Profiles (Profile_ID, First_Name, Last_Name, School_ID)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'school_id'
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Row Level Security
-- Convention:
--   * Teachers (authenticated) read everything they need.
--   * Writes are scoped to ownership where it makes sense.
--   * Tables fed by the Edge Function (service role bypasses RLS)
--     intentionally have NO client write policies.
-- ============================================================
ALTER TABLE Profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE Devices                ENABLE ROW LEVEL SECURITY;
ALTER TABLE Students               ENABLE ROW LEVEL SECURITY;
ALTER TABLE Courses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE Enrollments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE Active_Sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE Attendance_Logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE Device_Commands        ENABLE ROW LEVEL SECURITY;
ALTER TABLE Pending_Registrations  ENABLE ROW LEVEL SECURITY;

-- ---- Profiles: readable by all teachers; editable by owner ----
CREATE POLICY "profiles_select_authenticated" ON Profiles
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON Profiles
    FOR INSERT TO authenticated WITH CHECK (Profile_ID = auth.uid());
CREATE POLICY "profiles_update_own" ON Profiles
    FOR UPDATE TO authenticated USING (Profile_ID = auth.uid());
CREATE POLICY "profiles_delete_own" ON Profiles
    FOR DELETE TO authenticated USING (Profile_ID = auth.uid());

-- ---- Devices: shared registry; authenticated teachers manage terminals ----
CREATE POLICY "devices_select_authenticated" ON Devices
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "devices_write_authenticated" ON Devices
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---- Students: global directory; readable by all teachers ----
CREATE POLICY "students_select_authenticated" ON Students
    FOR SELECT TO authenticated USING (true);

-- ---- Courses: full CRUD restricted to the owning instructor ----
CREATE POLICY "courses_select_authenticated" ON Courses
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "courses_insert_own" ON Courses
    FOR INSERT TO authenticated WITH CHECK (Instructor_ID = auth.uid());
CREATE POLICY "courses_update_own" ON Courses
    FOR UPDATE TO authenticated USING (Instructor_ID = auth.uid());
CREATE POLICY "courses_delete_own" ON Courses
    FOR DELETE TO authenticated USING (Instructor_ID = auth.uid());

-- ---- Enrollments: manage roster only for courses you own ----
CREATE POLICY "enrollments_select_authenticated" ON Enrollments
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "enrollments_insert_own_course" ON Enrollments
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM Courses c
                WHERE c.Stub_Code = Enrollments.Stub_Code
                  AND c.Instructor_ID = auth.uid())
    );
CREATE POLICY "enrollments_delete_own_course" ON Enrollments
    FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM Courses c
                WHERE c.Stub_Code = Enrollments.Stub_Code
                  AND c.Instructor_ID = auth.uid())
    );

-- ---- Active_Sessions: only the creator manages their gate windows ----
CREATE POLICY "sessions_select_authenticated" ON Active_Sessions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "sessions_insert_own" ON Active_Sessions
    FOR INSERT TO authenticated WITH CHECK (Created_By = auth.uid());
CREATE POLICY "sessions_update_own" ON Active_Sessions
    FOR UPDATE TO authenticated USING (Created_By = auth.uid());
CREATE POLICY "sessions_delete_own" ON Active_Sessions
    FOR DELETE TO authenticated USING (Created_By = auth.uid());

-- ---- Attendance_Logs: READ-ONLY for clients.
--      No INSERT/UPDATE/DELETE policies on purpose:
--      writes flow exclusively through the Edge Function. ----
CREATE POLICY "logs_select_authenticated" ON Attendance_Logs
    FOR SELECT TO authenticated USING (true);

-- ---- Device_Commands: teachers create commands; ACK is service-role only ----
CREATE POLICY "commands_select_authenticated" ON Device_Commands
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "commands_insert_authenticated" ON Device_Commands
    FOR INSERT TO authenticated WITH CHECK (true);

-- ---- Pending_Registrations: teachers add queue entries;
--      binding/cleanup transitions are service-role only ----
CREATE POLICY "pending_reg_select_authenticated" ON Pending_Registrations
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "pending_reg_insert_authenticated" ON Pending_Registrations
    FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- Realtime streams
--   Attendance_Logs : dashboard live attendance updates
--   Device_Commands : dashboard sees device ACKs instantly
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.Attendance_Logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.Device_Commands;
