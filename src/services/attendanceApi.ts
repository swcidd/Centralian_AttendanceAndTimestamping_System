import { supabase } from "../lib/supabase";
import type { Activity, StudentAttendance, StudentStatus } from "../types/types";

export interface AttendanceLog {
  log_id: string;
  session_id: string;
  student_id: string | null;
  stub_code: string;
  // Null for rows that were pre-generated absent and never tapped.
  nfc_uid: string | null;
  device_mac: string | null;
  status: "PRESENT" | "LATE" | "ABSENT" | "UNKNOWN";
  timestamp: string;
}

// UNKNOWN rows have no Student_ID, so they never reach this map — every
// status a roster entry can carry has a known student behind it.
export const DB_STATUS_TO_UI: Record<
  "PRESENT" | "LATE" | "ABSENT",
  StudentStatus["status"]
> = {
  PRESENT: "Present",
  LATE: "Late",
  ABSENT: "Absent",
};

interface EnrolledRow {
  enrollment_id: string;
  dropped_at: string | null;
  students: {
    student_id: string;
    student_firstname: string;
    student_lastname: string;
  } | null;
}

// The database's lowercase enum onto the UI's capitalised labels.
// `excused` has no roster state of its own and reads as Absent.
function dbToUiStatus(status: string): StudentStatus["status"] {
  if (status === "present") return "Present";
  if (status === "late") return "Late";
  return "Absent";
}

function studentName(student: { student_firstname: string; student_lastname: string }) {
  return `${student.student_firstname} ${student.student_lastname}`;
}

// The live roster for one section: every enrolled student, defaulted to
// Absent until a matching attendance row for `sessionId` says otherwise.
// Pass sessionId: null when no session is open yet (roster only).
export async function fetchSessionRoster(
  stubCode: string,
  sessionId: string | null
): Promise<StudentStatus[]> {
  const stub = Number(stubCode);

  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select("enrollment_id, dropped_at, students(student_id, student_firstname, student_lastname)")
    .eq("course_stubcode", stub)
    .is("dropped_at", null)
    .returns<EnrolledRow[]>();

  if (enrollError) throw enrollError;

  // attendance keys off enrollment_id, so this map is what ties a tap
  // back to the student the roster row represents.
  const statusByEnrollment = new Map<string, StudentStatus["status"]>();
  if (sessionId) {
    const { data: rows, error: rowError } = await supabase
      .from("attendance")
      .select("enrollment_id, status")
      .eq("session_id", sessionId)
      .returns<Array<{ enrollment_id: string; status: string }>>();

    if (rowError) throw rowError;

    for (const row of rows ?? []) {
      statusByEnrollment.set(row.enrollment_id, dbToUiStatus(row.status));
    }
  }

  return (enrollments ?? [])
    .filter((row) => row.students !== null)
    .map((row) => ({
      id: (row.students as NonNullable<EnrolledRow["students"]>).student_id,
      name: studentName(row.students as NonNullable<EnrolledRow["students"]>),
      status: statusByEnrollment.get(row.enrollment_id) ?? "Absent",
    }));
}

// Per-student PRESENT/LATE/ABSENT totals across every course the student
// is enrolled in — not scoped to a single session or section, since
// StudentTrackTable renders one global roster.
export async function fetchStudentAttendanceRollup(): Promise<StudentAttendance[]> {
  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select("enrollment_id, dropped_at, students(student_id, student_firstname, student_lastname)")
    .returns<EnrolledRow[]>();

  if (enrollError) throw enrollError;

  const rollupByStudent = new Map<string, StudentAttendance>();
  const studentByEnrollment = new Map<string, string>();
  for (const row of enrollments ?? []) {
    const student = row.students;
    if (!student) continue;
    studentByEnrollment.set(row.enrollment_id, student.student_id);
    if (!rollupByStudent.has(student.student_id)) {
      rollupByStudent.set(student.student_id, {
        id: student.student_id,
        name: studentName(student),
        present: 0,
        late: 0,
        absent: 0,
      });
    }
  }

  const { data: rows, error: rowError } = await supabase
    .from("attendance")
    .select("enrollment_id, status")
    .returns<Array<{ enrollment_id: string; status: string }>>();

  if (rowError) throw rowError;

  for (const row of rows ?? []) {
    const studentId = studentByEnrollment.get(row.enrollment_id);
    const record = studentId ? rollupByStudent.get(studentId) : undefined;
    if (!record) continue;
    if (row.status === "present") record.present += 1;
    else if (row.status === "late") record.late += 1;
    else if (row.status === "absent") record.absent += 1;
  }

  return Array.from(rollupByStudent.values());
}

// One row per CLOSED session for a section, newest first, with
// PRESENT/LATE/ABSENT counts for the ActivityPage log view. Absent is
// derived as enrolledCount - present - late so a manually-closed session
// (which never writes absent rows itself) still reports its absences.
export async function fetchActivityLog(stubCode: string): Promise<Activity[]> {
  const stub = Number(stubCode);

  const { data: sessions, error: sessionError } = await supabase
    .from("class_sessions")
    .select("session_id, session_date")
    .eq("course_stubcode", stub)
    .not("closed_at", "is", null)
    .order("session_date", { ascending: false })
    .returns<Array<{ session_id: string; session_date: string }>>();

  if (sessionError) throw sessionError;
  if (!sessions || sessions.length === 0) return [];

  const { count: enrolledCount, error: enrollError } = await supabase
    .from("enrollments")
    .select("enrollment_id", { count: "exact", head: true })
    .eq("course_stubcode", stub)
    .is("dropped_at", null);

  if (enrollError) throw enrollError;

  const sessionIds = sessions.map((session) => session.session_id);
  const { data: rows, error: rowError } = await supabase
    .from("attendance")
    .select("session_id, status")
    .in("session_id", sessionIds)
    .returns<Array<{ session_id: string; status: string }>>();

  if (rowError) throw rowError;

  const countsBySession = new Map<string, { present: number; late: number }>();
  for (const row of rows ?? []) {
    if (row.status !== "present" && row.status !== "late") continue;
    const counts = countsBySession.get(row.session_id) ?? { present: 0, late: 0 };
    if (row.status === "present") counts.present += 1;
    else counts.late += 1;
    countsBySession.set(row.session_id, counts);
  }

  const total = enrolledCount ?? 0;
  return sessions.map((session) => {
    const counts = countsBySession.get(session.session_id) ?? {
      present: 0,
      late: 0,
    };
    return {
      id: session.session_id,
      date: new Date(`${session.session_date}T00:00:00`).toLocaleDateString(),
      present: counts.present,
      late: counts.late,
      absent: Math.max(total - counts.present - counts.late, 0),
    };
  });
}
