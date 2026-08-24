CREATE TABLE Instructors (
    Instructor_ID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    First_Name VARCHAR(100) NOT NULL,
    Last_Name VARCHAR(100) NOT NULL,
    Email VARCHAR(255) UNIQUE NOT NULL,
    NFC_UID VARCHAR(100) UNIQUE
);

CREATE TABLE Students (
    Student_ID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    School_ID VARCHAR(50) UNIQUE NOT NULL,
    First_Name VARCHAR(100) NOT NULL,
    Last_Name VARCHAR(100) NOT NULL,
    NFC_UID VARCHAR(100) UNIQUE NOT NULL,
    Course_Program VARCHAR(100),
    Year_Level INT
);

CREATE TABLE Devices (
    Device_MAC VARCHAR(50) PRIMARY KEY,
    Room_Name VARCHAR(100) NOT NULL,
    Status VARCHAR(20) DEFAULT 'ACTIVE'
);

CREATE TABLE Courses (
    Stub_Code VARCHAR(20) PRIMARY KEY,
    Subject_Code VARCHAR(50) NOT NULL,
    Course_Name VARCHAR(255) NOT NULL,
    Instructor_ID UUID REFERENCES Instructors(Instructor_ID),
    Device_MAC VARCHAR(50) REFERENCES Devices(Device_MAC),
    Start_Time TIME NOT NULL,
    End_Time TIME NOT NULL,
    Days_Of_Week VARCHAR(50) NOT NULL
);

CREATE TABLE Enrollments (
    Enrollment_ID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    Stub_Code VARCHAR(20) REFERENCES Courses(Stub_Code) ON DELETE CASCADE,
    Student_ID UUID REFERENCES Students(Student_ID) ON DELETE CASCADE
);

CREATE TABLE Active_Sessions (
    Session_ID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    Stub_Code VARCHAR(20) REFERENCES Courses(Stub_Code),
    Device_MAC VARCHAR(50) REFERENCES Devices(Device_MAC),
    Status VARCHAR(20) DEFAULT 'ACTIVE_ATTENDANCE',
    Started_At TIMESTAMPTZ DEFAULT NOW(),
    Expires_At TIMESTAMPTZ NOT NULL
);

CREATE TABLE Attendance_Logs (
    Log_ID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    Session_ID UUID REFERENCES Active_Sessions(Session_ID) ON DELETE CASCADE,
    Student_ID UUID REFERENCES Students(Student_ID) ON DELETE CASCADE,
    Stub_Code VARCHAR(20) REFERENCES Courses(Stub_Code),
    NFC_UID VARCHAR(100) NOT NULL,
    Device_MAC VARCHAR(50) NOT NULL,
    Status VARCHAR(20) DEFAULT 'PRESENT',
    Timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Realtime Stream
ALTER PUBLICATION supabase_realtime ADD TABLE public.Attendance_Logs;
