import { supabase } from "../lib/supabase";
import type { StudentStatus } from "../types/types";

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
