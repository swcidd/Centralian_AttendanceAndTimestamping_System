export interface Student {
  id: number;
  name: string;
  status: "Present" | "Late" | "Absent";
};

export interface Activity {
  id: number;
  date: string;
  present: number;
  absent: number;
  late: number;
};

export interface Course {
  stub: number;
  name: string;
  schedule: string;
  instructor: string;
}