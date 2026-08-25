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
  id: number;
  date: string;
  present: number;
  absent: number;
  late: number;
};

export interface Course {
  stub: string;
  name: string;
  schedule: string;
  instructor: string;
}