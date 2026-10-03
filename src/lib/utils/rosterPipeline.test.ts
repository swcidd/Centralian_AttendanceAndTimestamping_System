import { describe, it, expect } from "vitest";
import {
  buildAttendanceRollup,
  buildSessionRoster,
  enrolledStudents,
  foldLiveTaps,
  summarizeSessions,
  toTapEvents,
  toUiStatus,
  type EnrollmentRow,
  type StatusLog,
  type TapLog,
} from "./rosterPipeline";
import type { StudentStatus } from "../../types/types";

const sherwin = { student_id: "25-1809-52", first_name: "Sherwin", last_name: "Sañol" };
const jane = { student_id: "25-1809-53", first_name: "Jane", last_name: "Doe" };

const enrollments: EnrollmentRow[] = [
  { students: sherwin },
  { students: jane },
  { students: null },
  { students: sherwin },
];

describe("toUiStatus", () => {
  it("maps PRESENT/LATE/ABSENT to Ok UI statuses", () => {
    expect(toUiStatus("PRESENT")).toEqual({ ok: true, value: "Present" });
    expect(toUiStatus("LATE")).toEqual({ ok: true, value: "Late" });
    expect(toUiStatus("ABSENT")).toEqual({ ok: true, value: "Absent" });
  });

  it("returns Err for UNKNOWN instead of throwing", () => {
    expect(toUiStatus("UNKNOWN")).toEqual({
      ok: false,
      error: { reason: "UNMAPPED_STATUS", status: "UNKNOWN" },
    });
  });
});

describe("enrolledStudents", () => {
  it("drops null students and duplicate enrollments", () => {
    expect(enrolledStudents(enrollments)).toEqual([sherwin, jane]);
  });
});

describe("buildSessionRoster", () => {
  it("defaults everyone to Absent when there are no logs", () => {
    expect(buildSessionRoster(enrollments, [])).toEqual([
      { id: sherwin.student_id, name: "Sherwin Sañol", status: "Absent" },
      { id: jane.student_id, name: "Jane Doe", status: "Absent" },
    ]);
  });

  it("applies logged statuses and ignores UNKNOWN / studentless rows", () => {
    const logs: StatusLog[] = [
      { student_id: jane.student_id, status: "LATE" },
      { student_id: null, status: "UNKNOWN" },
    ];
    expect(buildSessionRoster(enrollments, logs).map((s) => s.status)).toEqual([
      "Absent",
      "Late",
    ]);
  });

  it("does not mutate its inputs", () => {
    const frozen = Object.freeze([...enrollments]);
    expect(() => buildSessionRoster(frozen, Object.freeze([]))).not.toThrow();
  });
});

describe("toTapEvents / foldLiveTaps", () => {
  const base: StudentStatus[] = [
    { id: sherwin.student_id, name: "Sherwin Sañol", status: "Absent" },
    { id: jane.student_id, name: "Jane Doe", status: "Absent" },
  ];
  const taps: TapLog[] = [
    { student_id: sherwin.student_id, status: "PRESENT", timestamp: "2026-10-03T08:00:00Z" },
    { student_id: null, status: "UNKNOWN", timestamp: "2026-10-03T08:01:00Z" },
    { student_id: jane.student_id, status: "LATE", timestamp: "2026-10-03T08:20:00Z" },
  ];

  it("skips UNKNOWN taps when building reducer events", () => {
    expect(toTapEvents(taps)).toHaveLength(2);
  });

  it("folds taps onto the base roster without mutating it", () => {
    const result = foldLiveTaps(Object.freeze(base), taps);
    expect(result.map((s) => s.status)).toEqual(["Present", "Late"]);
    expect(base.map((s) => s.status)).toEqual(["Absent", "Absent"]);
  });

  it("returns the base roster unchanged when there are no taps", () => {
    expect(foldLiveTaps(base, [])).toBe(base);
  });
});

describe("buildAttendanceRollup", () => {
  it("tallies PRESENT/LATE/ABSENT per student and ignores UNKNOWN", () => {
    const logs: StatusLog[] = [
      { student_id: sherwin.student_id, status: "PRESENT" },
      { student_id: sherwin.student_id, status: "LATE" },
      { student_id: sherwin.student_id, status: "PRESENT" },
      { student_id: jane.student_id, status: "ABSENT" },
      { student_id: null, status: "UNKNOWN" },
    ];
    expect(buildAttendanceRollup(enrollments, logs)).toEqual([
      { id: sherwin.student_id, name: "Sherwin Sañol", present: 2, late: 1, absent: 0 },
      { id: jane.student_id, name: "Jane Doe", present: 0, late: 0, absent: 1 },
    ]);
  });
});

describe("summarizeSessions", () => {
  it("counts present/late per session and derives absent from enrollment", () => {
    const sessions = [
      { session_id: "s1", started_at: "2026-10-01T08:00:00Z" },
      { session_id: "s2", started_at: "2026-10-02T08:00:00Z" },
    ];
    const logs = [
      { session_id: "s1", status: "PRESENT" as const },
      { session_id: "s1", status: "LATE" as const },
      { session_id: "s1", status: "ABSENT" as const },
    ];
    const [first, second] = summarizeSessions(sessions, logs, 5);
    expect(first).toMatchObject({ id: "s1", present: 1, late: 1, absent: 3 });
    expect(second).toMatchObject({ id: "s2", present: 0, late: 0, absent: 5 });
  });
});
