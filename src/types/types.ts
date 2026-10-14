export interface Student {
  id: string;
  name: string;
};

export interface StudentStatus extends Student {
  status: "Present" | "Late" | "Absent";
}

export interface StudentAttendance extends Student {
  present: number;
  late: number;
  absent: number;
}

export interface Activity {
  id: string;
  date: string;
  present: number;
  absent: number;
  late: number;
};

export type CourseType = "lect" | "lab";

/**
 * One section of a course. Its identity is (code, type), so the same
 * registrar number may appear twice under a course — once as a lecture
 * and once as a lab.
 */
export interface CourseSection {
  code: string;
  type: CourseType;
  /** Human-readable schedule line. Optional — populated on detail fetch. */
  schedule?: string;
  /** Room this stubcode's terminal is assigned to, if any. */
  roomName?: string | null;
  /** MAC of the assigned terminal device, if any. */
  deviceMac?: string | null;
}

export interface Course {
  courseId: string;
  /** Every section of this course (Course 1:N Section). */
  sections: CourseSection[];
  name: string;
  schedule: string;
  instructor: string;
  deviceMac: string | null;
  roomName: string | null;
}
