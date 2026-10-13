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

export interface Course {
  courseId: string;
  /** All stubcodes belonging to this course (Course 1:N Stubcode). */
  stubs: string[];
  /** Section type per stubcode — each section is lecture or lab. */
  stubTypes: Record<string, CourseType>;
  name: string;
  schedule: string;
  instructor: string;
  deviceMac: string | null;
  roomName: string | null;
}
