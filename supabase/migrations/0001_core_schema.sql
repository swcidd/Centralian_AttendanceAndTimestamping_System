-- Instructor profiles, 1:1 with auth.users. Profile_ID IS the auth user id,
-- so ownership policies compare directly against auth.uid().
CREATE TABLE Profiles (
    Profile_ID   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    First_Name   VARCHAR(100) NOT NULL,
    Last_Name    VARCHAR(100) NOT NULL,
    School_ID    VARCHAR(50) UNIQUE NOT NULL,
    Created_At   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Physical ESP32 terminals.
CREATE TABLE Devices (
    Device_MAC VARCHAR(50) PRIMARY KEY,
    Room_Name  VARCHAR(100) NOT NULL,
    Status     VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | OFFLINE | MAINTENANCE
    Created_At TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Student_ID is the student's school_id (written on the card); NFC_UID is
-- bound from the tap itself at registration time.
CREATE TABLE Students (
    Student_ID VARCHAR(50) PRIMARY KEY,
    First_Name VARCHAR(100) NOT NULL,
    Last_Name  VARCHAR(100) NOT NULL,
    NFC_UID    VARCHAR(100) UNIQUE NOT NULL,
    Created_At TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE Enrollments (
    Enrollment_ID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    Stub_Code     VARCHAR(20) NOT NULL REFERENCES Courses(Stub_Code) ON DELETE CASCADE,
    Student_ID    VARCHAR(50) NOT NULL REFERENCES Students(Student_ID) ON DELETE CASCADE,
    Enrolled_At   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (Stub_Code, Student_ID)
);

-- Gated windows: ACTIVE_ATTENDANCE counts taps, REGISTRATION binds cards.
CREATE TABLE Active_Sessions (
    Session_ID  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    Stub_Code   VARCHAR(20) NOT NULL REFERENCES Courses(Stub_Code),
    Device_MAC  VARCHAR(50) NOT NULL REFERENCES Devices(Device_MAC),
    Status      VARCHAR(30) NOT NULL DEFAULT 'ACTIVE_ATTENDANCE', -- ACTIVE_ATTENDANCE | REGISTRATION | CLOSED
    Started_At  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    Created_By  UUID REFERENCES Profiles(Profile_ID)
);

-- Append-only; inserts only via ingest-tap (service role). An unregistered
-- tap logs Student_ID NULL with Status 'UNKNOWN'.
CREATE TABLE Attendance_Logs (
    Log_ID     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    Session_ID UUID NOT NULL REFERENCES Active_Sessions(Session_ID) ON DELETE CASCADE,
    Student_ID VARCHAR(50) REFERENCES Students(Student_ID) ON DELETE CASCADE,
    Stub_Code  VARCHAR(20) NOT NULL REFERENCES Courses(Stub_Code),
    NFC_UID    VARCHAR(100) NOT NULL,
    Device_MAC VARCHAR(50) NOT NULL,
    Status     VARCHAR(20) NOT NULL DEFAULT 'PRESENT', -- PRESENT | LATE | UNKNOWN
    Timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dashboard -> device command mailbox, polled by the ESP32.
CREATE TABLE Device_Commands (
    Command_ID      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    Device_MAC      VARCHAR(50) NOT NULL REFERENCES Devices(Device_MAC) ON DELETE CASCADE,
    Stub_Code       VARCHAR(20) REFERENCES Courses(Stub_Code), -- context payload
    Command_Type    VARCHAR(30) NOT NULL,                      -- START_REGISTRATION | START_ATTENDANCE | END_SESSION
    Status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',    -- PENDING | ACKNOWLEDGED
    Created_At      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    Acknowledged_At TIMESTAMPTZ
);

-- Self-entered student info awaiting a card tap to bind.
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

CREATE INDEX idx_attendance_stub_time   ON Attendance_Logs (Stub_Code, Timestamp DESC);
CREATE INDEX idx_attendance_session     ON Attendance_Logs (Session_ID);
CREATE INDEX idx_device_commands_poll   ON Device_Commands (Status, Device_MAC);
CREATE INDEX idx_pending_reg_poll       ON Pending_Registrations (Status, Device_MAC);
CREATE INDEX idx_active_sessions_device ON Active_Sessions (Device_MAC, Status);
CREATE INDEX idx_enrollments_student    ON Enrollments (Student_ID);

-- Auto-creates the Profiles row at signup. SECURITY DEFINER so the insert is
-- allowed with no session/RLS context mid-signup.
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

-- Reads are open to authenticated teachers; writes are ownership-scoped.
-- Tables fed by the Edge Function have no client write policies.
ALTER TABLE Profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE Devices                ENABLE ROW LEVEL SECURITY;
ALTER TABLE Students               ENABLE ROW LEVEL SECURITY;
ALTER TABLE Courses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE Enrollments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE Active_Sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE Attendance_Logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE Device_Commands        ENABLE ROW LEVEL SECURITY;
ALTER TABLE Pending_Registrations  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_authenticated" ON Profiles
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON Profiles
    FOR INSERT TO authenticated WITH CHECK (Profile_ID = auth.uid());
CREATE POLICY "profiles_update_own" ON Profiles
    FOR UPDATE TO authenticated USING (Profile_ID = auth.uid());
CREATE POLICY "profiles_delete_own" ON Profiles
    FOR DELETE TO authenticated USING (Profile_ID = auth.uid());

CREATE POLICY "devices_select_authenticated" ON Devices
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "devices_write_authenticated" ON Devices
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "students_select_authenticated" ON Students
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "courses_select_authenticated" ON Courses
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "courses_insert_own" ON Courses
    FOR INSERT TO authenticated WITH CHECK (Instructor_ID = auth.uid());
CREATE POLICY "courses_update_own" ON Courses
    FOR UPDATE TO authenticated USING (Instructor_ID = auth.uid());
CREATE POLICY "courses_delete_own" ON Courses
    FOR DELETE TO authenticated USING (Instructor_ID = auth.uid());

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

CREATE POLICY "sessions_select_authenticated" ON Active_Sessions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "sessions_insert_own" ON Active_Sessions
    FOR INSERT TO authenticated WITH CHECK (Created_By = auth.uid());
CREATE POLICY "sessions_update_own" ON Active_Sessions
    FOR UPDATE TO authenticated USING (Created_By = auth.uid());
CREATE POLICY "sessions_delete_own" ON Active_Sessions
    FOR DELETE TO authenticated USING (Created_By = auth.uid());

-- Read-only for clients; writes flow through the Edge Function.
CREATE POLICY "logs_select_authenticated" ON Attendance_Logs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "commands_select_authenticated" ON Device_Commands
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "commands_insert_authenticated" ON Device_Commands
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "pending_reg_select_authenticated" ON Pending_Registrations
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "pending_reg_insert_authenticated" ON Pending_Registrations
    FOR INSERT TO authenticated WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.Attendance_Logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.Device_Commands;
