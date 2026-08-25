import { supabase } from "../lib/supabase";
import type { Activity, StudentAttendance, StudentStatus } from "../types/types";

export interface AttendanceLog {
  log_id: string;
  session_id: string;
  student_id: string | null;
  stub_code: string;
  // Null for ABSENT rows, which are auto-written by finalize_absences()
  // with no physical tap behind them.
  nfc_uid: string | null;
  device_mac: string | null;
  status: "PRESENT" | "LATE" | "ABSENT" | "UNKNOWN";
  timestamp: string;
}

// UNKNOWN rows have no Student_ID, so they never reach this map — every
// status a roster entry can carry has a known student behind it.
export const DB_STATUS_TO_UI: Record<"PRESENT" | "LATE" | "ABSENT", StudentStatus["status"]> = {
  PRESENT: "Present",
  LATE: "Late",
  ABSENT: "Absent",
};

interface EnrolledStudentRow {
  students: { student_id: string; first_name: string; last_name: string } | null;
}

// The live roster for one course: every enrolled student, defaulted to
// Absent until a matching Attendance_Logs row for `sessionId` says
// otherwise. Pass sessionId: null when no session is open yet (roster
// only, nobody has a status).
export async function fetchSessionRoster(
  stubCode: string,
  sessionId: string | null
): Promise<StudentStatus[]> {
  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select("students(student_id, first_name, last_name)")
    .eq("stub_code", stubCode)
    .returns<EnrolledStudentRow[]>();

  if (enrollError) throw enrollError;

  const statusByStudent = new Map<string, StudentStatus["status"]>();
  if (sessionId) {
    const { data: logs, error: logError } = await supabase
      .from("attendance_logs")
      .select("student_id, status")
      .eq("session_id", sessionId)
      .not("student_id", "is", null)
      .returns<Array<Pick<AttendanceLog, "student_id" | "status">>>();

    if (logError) throw logError;

    for (const log of logs ?? []) {
      statusByStudent.set(
        log.student_id as string,
        DB_STATUS_TO_UI[log.status as "PRESENT" | "LATE" | "ABSENT"]
      );
    }
  }

  return (enrollments ?? [])
    .map((row) => row.students)
    .filter((student): student is NonNullable<typeof student> => student !== null)
    .map((student) => ({
      id: student.student_id,
      name: `${student.first_name} ${student.last_name}`,
      status: statusByStudent.get(student.student_id) ?? "Absent",
    }));
}

// Per-student PRESENT/LATE/ABSENT totals across every course the student
// is enrolled in — not scoped to a single session or course, since
// StudentTrackTable renders one global roster. UNKNOWN rows are excluded
// automatically: they carry no Student_ID, so they never match a student
// here (same reasoning as DB_STATUS_TO_UI above).
export async function fetchStudentAttendanceRollup(): Promise<StudentAttendance[]> {
  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select("students(student_id, first_name, last_name)")
    .returns<EnrolledStudentRow[]>();

  if (enrollError) throw enrollError;

  const rollupByStudent = new Map<string, StudentAttendance>();
  for (const row of enrollments ?? []) {
    const student = row.students;
    if (!student || rollupByStudent.has(student.student_id)) continue;
    rollupByStudent.set(student.student_id, {
      id: student.student_id,
      name: `${student.first_name} ${student.last_name}`,
      present: 0,
      late: 0,
      absent: 0,
    });
  }

  const { data: logs, error: logError } = await supabase
    .from("attendance_logs")
    .select("student_id, status")
    .not("student_id", "is", null)
    .returns<Array<Pick<AttendanceLog, "student_id" | "status">>>();

  if (logError) throw logError;

  for (const log of logs ?? []) {
    const record = rollupByStudent.get(log.student_id as string);
    if (!record) continue;
    if (log.status === "PRESENT") record.present += 1;
    else if (log.status === "LATE") record.late += 1;
    else if (log.status === "ABSENT") record.absent += 1;
  }

  return Array.from(rollupByStudent.values());
}

// One row per CLOSED session for a course, newest first, with
// PRESENT/LATE/ABSENT counts for the ActivityPage log view. Absent is
// derived as enrolledCount - present - late (same "no log row = Absent"
// default fetchSessionRoster uses) rather than counting only ABSENT
// rows, since a manually-closed session (closeSession() in
// sessionsApi.ts) never writes ABSENT rows itself -- only
// finalize_absences() does, once a course's Absent_After_Minutes
// threshold is set and reached.
export async function fetchActivityLog(stubCode: string): Promise<Activity[]> {
  const { data: sessions, error: sessionError } = await supabase
    .from("active_sessions")
    .select("session_id, started_at")
    .eq("stub_code", stubCode)
    .eq("status", "CLOSED")
    .order("started_at", { ascending: false })
    .returns<Array<{ session_id: string; started_at: string }>>();

  if (sessionError) throw sessionError;
  if (!sessions || sessions.length === 0) return [];

  const { count: enrolledCount, error: enrollError } = await supabase
    .from("enrollments")
    .select("student_id", { count: "exact", head: true })
    .eq("stub_code", stubCode);

  if (enrollError) throw enrollError;

  const sessionIds = sessions.map((session) => session.session_id);
  const { data: logs, error: logError } = await supabase
    .from("attendance_logs")
    .select("session_id, status")
    .in("session_id", sessionIds)
    .not("student_id", "is", null)
    .returns<Array<{ session_id: string; status: AttendanceLog["status"] }>>();

  if (logError) throw logError;

  const countsBySession = new Map<string, { present: number; late: number }>();
  for (const log of logs ?? []) {
    if (log.status !== "PRESENT" && log.status !== "LATE") continue;
    const counts = countsBySession.get(log.session_id) ?? { present: 0, late: 0 };
    if (log.status === "PRESENT") counts.present += 1;
    else counts.late += 1;
    countsBySession.set(log.session_id, counts);
  }

  const total = enrolledCount ?? 0;
  return sessions.map((session) => {
    const counts = countsBySession.get(session.session_id) ?? { present: 0, late: 0 };
    return {
      id: session.session_id,
      date: new Date(session.started_at).toLocaleDateString(),
      present: counts.present,
      late: counts.late,
      absent: Math.max(total - counts.present - counts.late, 0),
    };
  });
}
