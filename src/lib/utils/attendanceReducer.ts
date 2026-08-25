import type { StudentStatus } from "../../types/types";

export interface RosterState {
  students: readonly StudentStatus[];
}

export interface TapEvent {
  studentId: string;
  timestamp: string;
  status: StudentStatus["status"];
}

// Pure: given the current roster and a tap event, returns a new roster
// state without mutating `state` or its `students` array.
export function attendanceReducer(
  state: RosterState,
  event: TapEvent
): RosterState {
  return {
    students: state.students.map((student) =>
      student.id === event.studentId
        ? { ...student, status: event.status }
        : student
    ),
  };
}
