import { supabase } from "../lib/supabase";
import {
  buildAttendanceRollup,
  buildSessionRoster,
  summarizeSessions,
  type DbStatus,
  type EnrollmentRow,
  type SessionLog,
  type SessionRow,
  type StatusLog,
} from "../lib/utils/rosterPipeline";
import type { Activity, StudentAttendance, StudentStatus } from "../types/types";

// I/O shell: each function here only fetches rows and hands them to the
// pure pipelines in lib/utils/rosterPipeline.ts, which own the shaping.

export interface AttendanceLog {
  log_id: string;
  session_id: string;
  student_id: string | null;
  stub_code: string;
  // Null for ABSENT rows, which are auto-written by finalize_absences()
  // with no physical tap behind them.
  nfc_uid: string | null;
  device_mac: string | null;
  status: DbStatus;
  timestamp: string;
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
    .returns<EnrollmentRow[]>();

  if (enrollError) throw enrollError;

  let logs: StatusLog[] = [];
  if (sessionId) {
    const { data, error: logError } = await supabase
      .from("attendance_logs")
      .select("student_id, status")
      .eq("session_id", sessionId)
      .not("student_id", "is", null)
      .returns<StatusLog[]>();

    if (logError) throw logError;
    logs = data ?? [];
  }

  return buildSessionRoster(enrollments ?? [], logs);
}

// Per-student PRESENT/LATE/ABSENT totals across every course the student
// is enrolled in — not scoped to a single session or course, since
// StudentTrackTable renders one global roster.
export async function fetchStudentAttendanceRollup(): Promise<StudentAttendance[]> {
  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select("students(student_id, first_name, last_name)")
    .returns<EnrollmentRow[]>();

  if (enrollError) throw enrollError;

  const { data: logs, error: logError } = await supabase
    .from("attendance_logs")
    .select("student_id, status")
    .not("student_id", "is", null)
    .returns<StatusLog[]>();

  if (logError) throw logError;

  return buildAttendanceRollup(enrollments ?? [], logs ?? []);
}

// One row per CLOSED session for a course, newest first, with
// PRESENT/LATE/ABSENT counts for the ActivityPage log view (see
// summarizeSessions for how Absent is derived).
export async function fetchActivityLog(stubCode: string): Promise<Activity[]> {
  const { data: sessions, error: sessionError } = await supabase
    .from("active_sessions")
    .select("session_id, started_at")
    .eq("stub_code", stubCode)
    .eq("status", "CLOSED")
    .order("started_at", { ascending: false })
    .returns<SessionRow[]>();

  if (sessionError) throw sessionError;
  if (!sessions || sessions.length === 0) return [];

  const { count: enrolledCount, error: enrollError } = await supabase
    .from("enrollments")
    .select("student_id", { count: "exact", head: true })
    .eq("stub_code", stubCode);

  if (enrollError) throw enrollError;

  const { data: logs, error: logError } = await supabase
    .from("attendance_logs")
    .select("session_id, status")
    .in(
      "session_id",
      sessions.map((session) => session.session_id)
    )
    .not("student_id", "is", null)
    .returns<SessionLog[]>();

  if (logError) throw logError;

  return summarizeSessions(sessions, logs ?? [], enrolledCount ?? 0);
}
