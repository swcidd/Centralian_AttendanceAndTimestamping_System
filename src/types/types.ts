export interface Student {
  student_id: string;
  student_firstname: string;
  student_lastname: string;
  student_program?: string;
}

export interface StudentCard {
  card_id: string;
  student_id: string;
  nfc_uid: string;
  issued_at: string;
  revoked_at?: string;
}

export interface Course {
  course_id: string;
  course_type: "lect" | "lab";
  course_code: string;
  course_name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Course {
  course_id: string;
  course_type: "lect" | "lab";
  course_code: string;
  course_name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Stubcode {
  course_stubcode: number;
  course_id: string;
  instructor_id: string;
  created_at: string;
  updated_at: string;
}

export interface StubcodeSchedule {
  stubcode_schedule_id: string;
  course_stubcode: number;
  schedule_room: string;
  schedule_day: number;      // 1=Monday ... 7=Sunday (ISO)
  schedule_start: string;    // HH:MM
  schedule_end: string;      // HH:MM
  late_after_minutes: number;
  absent_after_minutes: number;
}

export interface Enrollment {
  enrollment_id: string;
  course_stubcode: number;
  student_id: string;
  enrolled_at: string;
  dropped_at?: string;
}

export interface AttendanceRecord {
  attendance_id: string;
  session_id: string;
  enrollment_id: string;
  course_stubcode: number;
  status: "present" | "late" | "absent";
  attendance_timestamp?: string;
  source: "system" | "instructor";
}

export interface ClassSession {
  session_id: string;
  stubcode_schedule_id: string;
  course_stubcode: number;
  session_date: string;     // YYYY-MM-DD
  closed_at?: string;
}

export interface RoomMode {
  room: string;
  mode: "enroll" | "attend";
  course_stubcode: number;
  session_id?: string;
  opened_at: string;
}

export interface ScanResult {
  result: "ok" | "unknown_card" | "not_enrolled" | "no_active_mode" | "duplicate" | "rejected";
  attendance_status: "present" | "late" | "absent";
}

export interface ScanLog {
  scan_id: string;
  scanned_at: string;
  room: string;
  nfc_uid: string;
  mode?: string;
  result: string;
  student_id?: string;
  course_stubcode?: number;
  session_id?: string;
}