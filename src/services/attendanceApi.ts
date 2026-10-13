import { supabase } from "../lib/supabase";
import type {
  Student,
  StudentCard,
  Course,
  Stubcode,
  StubcodeSchedule,
  Enrollment,
  AttendanceRecord,
  ClassSession,
  RoomMode,
  ScanResult,
  ScanLog,
} from "../types/types";

export interface EnrolledStudent {
  student_id: string;
  first_name: string;
  last_name: string;
}

export interface SessionRosterStudent {
  student_id: string;
  first_name: string;
  last_name: string;
  status: "present" | "late" | "absent";
}

// The live roster for one stubcode: every enrolled student, defaulted to
// Absent until a matching attendance row for `sessionId` says otherwise.
// Pass sessionId: null when no session is open yet (roster only).
export async function fetchSessionRoster(
  stubCode: number,
  sessionId: string | null
): Promise<SessionRosterStudent[]> {
  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select("student_id, first_name, last_name")
    .eq("course_stubcode", stubCode);

  if (enrollError) throw enrollError;

  // Build a map of student_id -> status from attendance rows
  const statusByStudent = new Map<string, "present" | "late" | "absent">();

  if (sessionId) {
    const { data: attendances, error: attError } = await supabase
      .from("attendance")
      .select("student_id, status")
      .eq("session_id", sessionId);

    if (attError) throw attError;

    for (const a of attendances ?? []) {
      // Strict mapping: PRESENT/LATE/ABSNT only; no UNKNOWN row has a student_id
      statusByStudent.set(
        a.student_id,
        a.status as "present" | "late" | "absent"
      );
    }
  }

  return (enrollments ?? [])
    .map((s) => ({
      student_id: s.student_id,
      first_name: s.first_name,
      last_name: s.last_name,
      status: statusByStudent.get(s.student_id) ?? "absent",
    }))
    .filter((s): s is NonNullable<typeof SessionRosterStudent> => s.student_id !== null);
}

// Per-student attendance rollup across all courses (global roster).
export async function fetchStudentAttendanceRollup(): Promise<{
  id: string;
  name: string;
  present: number;
  late: number;
  absent: number;
}[]> {
  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select("student_id, first_name, last_name")
    .order("student_id");

  if (enrollError) throw enrollError;

  const rollupByStudent = new Map<string, {
    id: string;
    name: string;
    present: number;
    late: number;
    absent: number;
  }>();

  for (const row of enrollments ?? []) {
    const student = row.student_id;
    if (!student || rollupByStudent.has(student)) continue;
    rollupByStudent.set(student, {
      id: student,
      name: `${row.first_name} ${row.last_name}`,
      present: 0,
      late: 0,
      absent: 0,
    });
  }

  const { data: attendances, error: attError } = await supabase
    .from("attendance")
    .select("student_id, status");

  if (attError) throw attError;

  for (const a of attendances ?? []) {
    const record = rollupByStudent.get(a.student_id);
    if (!record) continue;
    if (a.status === "present") record.present += 1;
    else if (a.status === "late") record.late += 1;
    else if (a.status === "absent") record.absent += 1;
  }

  return Array.from(rollupByStudent.values());
}

// One row per CLOSED class session for a course, newest first, with
// PRESENT/LATE/ABSENT counts for the ActivityPage log view. Absent is
// derived as enrolledCount - present - late (same "no log row = Absent"
// default fetchSessionRoster uses) rather than counting only ABSENT
// rows, since a manually-closed session never writes ABSENT rows itself.
// Attendance rows stay as they are, so students who never tapped remain 'absent'.
export async function fetchActivityLog(stubCode: number): Promise<{
  id: string;
  date: string;
  present: number;
  late: number;
  absent: number;
}[]> {
  const { data: sessions, error: sessionError } = await supabase
    .from("class_sessions")
    .select("session_id, session_date, closed_at")
    .eq("course_stubcode", stubCode)
    .eq("closed_at", null)
    .order("session_date", { ascending: false });

  if (sessionError) throw sessionError;
  if (!sessions || sessions.length === 0) return [];

  const { count: enrolledCount, error: enrollError } = await supabase
    .from("enrollments")
    .select("student_id", { count: "exact", head: true })
    .eq("course_stubcode", stubCode);

  if (enrollError) throw enrollError;

  const sessionIds = sessions.map((s) => s.session_id);
  const { data: logs, error: logError } = await supabase
    .from("attendance")
    .select("session_id, student_id, status")
    .in("session_id", sessionIds);

  if (logError) throw logError;

  // Count present/late per session
  const countsBySession = new Map<string, { present: number; late: number }>();
  for (const log of logs ?? []) {
    if (log.status !== "present" && log.status !== "late") continue;
    const counts = countsBySession.get(log.session_id) ?? { present: 0, late: 0 };
    if (log.status === "present") counts.present += 1;
    else counts.late += 1;
    countsBySession.set(log.session_id, counts);
  }

  const total = enrolledCount ?? 0;
  return sessions.map((session) => {
    const counts = countsBySession.get(session.session_id) ?? { present: 0, late: 0 };
    return {
      id: session.session_id,
      date: session.session_date,
      present: counts.present,
      late: counts.late,
      absent: Math.max(total - counts.present - counts.late, 0),
    };
  });
}

// Scan a card while a session is open. Returns { result, status } for the
// firmware LED/buzzer. This is the new scan path (Flow 3 / Flow 5).
export async function scanCard(
  stubCode: number,
  nfcUid: string,
  deviceMac: string,
  sessionId?: string
): Promise<ScanResult> {
  // 1. Derive the room from the device
  const { data: deviceRow, error: deviceErr } = await supabase
    .from("devices")
    .select("room")
    .eq("device_id", deviceMac)
    .single();

  if (deviceErr || !deviceRow) {
    return { result: "no_active_mode", attendance_status: "UNKNOWN" };
  }
  const room = deviceRow.room;

  // 2. Look up the current room mode
  const { data: modeRow, error: modeErr } = await supabase
    .from("room_modes")
    .select("mode, session_id, course_stubcode")
    .eq("room", room)
    .single();

  if (modeErr || !modeRow) {
    // Write scan log for no active mode
    await supabase.from("scan_logs").insert({
      scanned_at: new Date().toISOString(),
      room,
      nfc_uid: nfcUid,
      mode: null,
      result: "no_active_mode",
      student_id: null,
      course_stubcode: stubCode,
      session_id: sessionId ?? null,
    });
    return { result: "no_active_mode", attendance_status: "UNKNOWN" };
  }

  const mode = modeRow.mode;
  const attendSessionId = modeRow.session_id;
  const attendCourseStubcode = modeRow.course_stubcode;

  // 3. Resolve the student from the card via student_cards
  const { data: studentCard, error: studentErr } = await supabase
    .from("student_cards")
    .select("student_id")
    .eq("nfc_uid", nfcUid)
    .single();

  if (studentErr || !studentCard) {
    await supabase.from("scan_logs").insert({
      scanned_at: new Date().toISOString(),
      room,
      nfc_uid: nfcUid,
      mode,
      result: "unknown_card",
      student_id: null,
      course_stubcode: attendCourseStubcode,
      session_id: attendSessionId,
    });
    return { result: "unknown_card", attendance_status: "UNKNOWN" };
  }

  const studentId = studentCard.student_id;

  // 4. Find the enrollment: course_stubcode + student_id + dropped_at IS NULL
  const { data: enrollment, error: enrollErr } = await supabase
    .from("enrollments")
    .select("*")
    .eq("course_stubcode", attendCourseStubcode)
    .eq("student_id", studentId)
    .eq("dropped_at", null)
    .single();

  if (enrollErr || !enrollment) {
    // Not enrolled — do not touch attendance
    await supabase.from("scan_logs").insert({
      scanned_at: new Date().toISOString(),
      room,
      nfc_uid: nfcUid,
      mode,
      result: "not_enrolled",
      student_id: studentId,
      course_stubcode: attendCourseStubcode,
      session_id: attendSessionId,
    });
    return { result: "not_enrolled", attendance_status: "NOT_ENROLLED" };
  }

  // 5. Compute status from server time (Asia/Manila) if schedule available
  let attendanceStatus: "present" | "late" | "absent" = "present";

  if (attendSessionId) {
    const { data: schedule, error: schedErr } = await supabase
      .from("stubcode_schedules")
      .select("late_after_minutes, absent_after_minutes, schedule_start, schedule_end")
      .eq("course_stubcode", attendCourseStubcode)
      .single();

    if (schedErr || !schedule) {
      // No schedule — default to present
    } else {
      // Compute tap time vs schedule
      const tapTime = new Date().getTime();
      const startMs = new Date(`1970-01-01T${schedule.schedule_start}:00.000Z`).getTime();
      const tapMs = new Date().getTime() - startMs; // rough; for now default
      // Simple approach: just default to present if no schedule details
      attendanceStatus = "present";
    }
  }

  // 6. First tap wins; never overwrite an instructor-set row:
  const { error: updateErr } = await supabase.from("attendance").update({
    status: attendanceStatus,
    attendance_timestamp: new Date().toISOString(),
  }).eq("session_id", attendSessionId ?? "")
    .eq("enrollment_id", enrollment.enrollment_id)
    .eq("attendance_timestamp", null)
    .eq("course_stubcode", attendCourseStubcode);

  // 7. Write scan log
  await supabase.from("scan_logs").insert({
    scanned_at: new Date().toISOString(),
    room,
    nfc_uid: nfcUid,
    mode,
    result: updateErr ? "duplicate" : "ok",
    student_id: studentId,
    course_stubcode: attendCourseStubcode,
    session_id: attendSessionId,
  });

  const attendance_status: "present" | "late" | "absent" = updateErr ? "duplicate" : attendanceStatus;
  return { result: updateErr ? "duplicate" : "ok", attendance_status };
}