import { describe, it, expect } from "vitest";
import { attendanceReducer, type RosterState, type TapEvent } from "./attendanceReducer";
import type { StudentStatus } from "../../types/types";

// Recursively freeze so any mutation attempt throws in ESM strict mode.
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

const roster: StudentStatus[] = [
  { id: "25-1809-52", name: "Sherwin Sid Sañol", status: "Absent" },
  { id: "25-1809-53", name: "Jane Doe", status: "Present" },
  { id: "25-1809-54", name: "John Roe", status: "Late" },
];

const initialState: RosterState = { students: roster };

describe("attendanceReducer", () => {
  it("updates the status of the matching student", () => {
    const event: TapEvent = {
      studentId: "25-1809-53",
      timestamp: "2026-09-17T08:00:00Z",
      status: "Late",
    };
    const next = attendanceReducer(initialState, event);

    expect(next.students[1]).toEqual({ ...roster[1], status: "Late" });
    expect(next.students[1].status).toBe("Late");
  });

  it("leaves non-matching students untouched (reference equality)", () => {
    const event: TapEvent = {
      studentId: "25-1809-52",
      timestamp: "2026-09-17T08:00:00Z",
      status: "Present",
    };
    const next = attendanceReducer(initialState, event);

    // The reducer maps over the array, so non-matched elements keep
    // the exact same object references.
    expect(next.students[1]).toBe(roster[1]);
    expect(next.students[2]).toBe(roster[2]);
  });

  it("returns a new roster array, not the same reference", () => {
    const event: TapEvent = {
      studentId: "25-1809-53",
      timestamp: "2026-09-17T08:00:00Z",
      status: "Absent",
    };
    const next = attendanceReducer(initialState, event);

    expect(next.students).not.toBe(initialState.students);
  });

  it("does not mutate the input state or its students", () => {
    const frozen = deepFreeze<{ students: StudentStatus[] }>({
      students: roster.map((s) => ({ ...s })),
    });
    const event: TapEvent = {
      studentId: "25-1809-53",
      timestamp: "2026-09-17T08:00:00Z",
      status: "Late",
    };

    // Would throw a TypeError if the reducer tried to write to the
    // frozen state or any frozen student object.
    expect(() => attendanceReducer(frozen, event)).not.toThrow();
    expect(frozen.students[1].status).toBe("Present");
  });

  it("handles a student id not present in the roster without error", () => {
    const event: TapEvent = {
      studentId: "does-not-exist",
      timestamp: "2026-09-17T08:00:00Z",
      status: "Present",
    };
    const next = attendanceReducer(initialState, event);

    expect(next.students).toEqual(roster);
    expect(next.students[1]).toBe(roster[1]);
  });
});