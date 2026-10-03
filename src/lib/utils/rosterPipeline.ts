import { compose, pipe } from "./composition";
import { Ok, Err, type Result } from "./result";
import { attendanceReducer, type RosterState, type TapEvent } from "./attendanceReducer";
import type { Activity, Student, StudentAttendance, StudentStatus } from "../../types/types";

// The pure core behind attendanceApi.ts and TrackingPage: every function
// here takes rows already fetched from Supabase and returns new UI state,
// so the services stay a thin I/O shell and this file owns the data flow.

export type DbStatus = "PRESENT" | "LATE" | "ABSENT" | "UNKNOWN";
type UiStatus = StudentStatus["status"];

export interface StudentRow {
  student_id: string;
  first_name: string;
  last_name: string;
}

export interface EnrollmentRow {
  students: StudentRow | null;
}

export interface StatusLog {
  student_id: string | null;
  status: DbStatus;
}

export interface TapLog extends StatusLog {
  timestamp: string;
}

export interface SessionRow {
  session_id: string;
  started_at: string;
}

export interface SessionLog {
  session_id: string;
  status: DbStatus;
}

export interface StatusError {
  reason: "UNMAPPED_STATUS";
  status: DbStatus;
}

// Pure: DB status -> UI status. UNKNOWN (an unregistered card, no
// Student_ID behind it) has no roster row to land on, so it comes back
// as an Err the callers skip instead of an unchecked cast.
export function toUiStatus(status: DbStatus): Result<UiStatus, StatusError> {
  switch (status) {
    case "PRESENT":
      return Ok("Present");
    case "LATE":
      return Ok("Late");
    case "ABSENT":
      return Ok("Absent");
    default:
      return Err({ reason: "UNMAPPED_STATUS", status });
  }
}

// Stage: enrollment rows -> distinct students. A student enrolled in
// several stubcodes appears once per enrollment, so keep the first.
export function enrolledStudents(rows: readonly EnrollmentRow[]): readonly StudentRow[] {
  return rows
    .map((row) => row.students)
    .filter((student): student is StudentRow => student !== null)
    .filter(
      (student, index, all) =>
        all.findIndex((other) => other.student_id === student.student_id) === index
    );
}

const toStudent = (row: StudentRow): Student => ({
  id: row.student_id,
  name: `${row.first_name} ${row.last_name}`,
});

const withStatus =
  (lookup: ReadonlyMap<string, UiStatus>) =>
  (student: Student): StudentStatus => ({
    ...student,
    status: lookup.get(student.id) ?? "Absent",
  });

const withZeroCounts = (student: Student): StudentAttendance => ({
  ...student,
  present: 0,
  late: 0,
  absent: 0,
});

// Stage: logs -> studentId => UI status. Rows without a student or with
// an unmapped status are dropped through toUiStatus's Result.
export function statusLookup(logs: readonly StatusLog[]): ReadonlyMap<string, UiStatus> {
  return new Map(
    logs.flatMap((log) => {
      const status = toUiStatus(log.status);
      return log.student_id && status.ok ? [[log.student_id, status.value] as const] : [];
    })
  );
}

// enrollments -> distinct students -> roster entries, every student
// defaulted to Absent until a log for the session says otherwise.
export function buildSessionRoster(
  enrollments: readonly EnrollmentRow[],
  logs: readonly StatusLog[]
): StudentStatus[] {
  const toRosterEntry = compose(withStatus(statusLookup(logs)), toStudent);
  return pipe(enrollments, enrolledStudents, (students) => students.map(toRosterEntry));
}

// Stage: realtime tap rows -> reducer events, skipping UNKNOWN taps.
export function toTapEvents(taps: readonly TapLog[]): TapEvent[] {
  return taps.flatMap((tap) => {
    const status = toUiStatus(tap.status);
    return tap.student_id && status.ok
      ? [{ studentId: tap.student_id, timestamp: tap.timestamp, status: status.value }]
      : [];
  });
}

const applyTaps =
  (base: readonly StudentStatus[]) =>
  (events: readonly TapEvent[]): RosterState =>
    events.reduce(attendanceReducer, { students: base });

// base roster + live taps -> current roster. Folding the whole tap list
// (not just the newest) keeps this correct when several taps land in
// the same render batch.
export function foldLiveTaps(
  base: readonly StudentStatus[],
  taps: readonly TapLog[]
): readonly StudentStatus[] {
  return pipe(taps, toTapEvents, applyTaps(base), (state) => state.students);
}

const TALLY_FIELD = {
  PRESENT: "present",
  LATE: "late",
  ABSENT: "absent",
} as const satisfies Record<Exclude<DbStatus, "UNKNOWN">, keyof StudentAttendance>;

const countStatus = (tally: StudentAttendance, status: DbStatus): StudentAttendance =>
  status === "UNKNOWN"
    ? tally
    : { ...tally, [TALLY_FIELD[status]]: tally[TALLY_FIELD[status]] + 1 };

// Groups statuses by student. The Map is local to this call and never
// escapes mutable, so the function stays pure from the outside.
const statusesByStudent = (logs: readonly StatusLog[]): ReadonlyMap<string, DbStatus[]> =>
  logs.reduce((groups, log) => {
    if (log.student_id) {
      groups.set(log.student_id, [...(groups.get(log.student_id) ?? []), log.status]);
    }
    return groups;
  }, new Map<string, DbStatus[]>());

// enrollments -> distinct students -> per-student PRESENT/LATE/ABSENT
// totals across every course. UNKNOWN rows carry no Student_ID, so they
// never match a student here.
export function buildAttendanceRollup(
  enrollments: readonly EnrollmentRow[],
  logs: readonly StatusLog[]
): StudentAttendance[] {
  const grouped = statusesByStudent(logs);
  const emptyTally = compose(withZeroCounts, toStudent);
  return pipe(enrollments, enrolledStudents, (students) =>
    students.map((row) =>
      (grouped.get(row.student_id) ?? []).reduce(countStatus, emptyTally(row))
    )
  );
}

// One Activity per closed session with PRESENT/LATE counts. Absent is
// derived as enrolledCount - present - late rather than counting ABSENT
// rows, since a manually-closed session never writes ABSENT rows itself
// -- only finalize_absences() does, once a course's threshold is reached.
export function summarizeSessions(
  sessions: readonly SessionRow[],
  logs: readonly SessionLog[],
  enrolledCount: number
): Activity[] {
  const counts = logs.reduce((bySession, log) => {
    if (log.status === "PRESENT" || log.status === "LATE") {
      const current = bySession.get(log.session_id) ?? { present: 0, late: 0 };
      bySession.set(log.session_id, {
        present: current.present + (log.status === "PRESENT" ? 1 : 0),
        late: current.late + (log.status === "LATE" ? 1 : 0),
      });
    }
    return bySession;
  }, new Map<string, { present: number; late: number }>());

  return sessions.map((session) => {
    const { present, late } = counts.get(session.session_id) ?? { present: 0, late: 0 };
    return {
      id: session.session_id,
      date: new Date(session.started_at).toLocaleDateString(),
      present,
      late,
      absent: Math.max(enrolledCount - present - late, 0),
    };
  });
}
