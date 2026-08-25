import { supabase } from "../lib/supabase";

export interface AttendanceLog {
  log_id: string;
  session_id: string;
  student_id: string | null;
  stub_code: string;
  nfc_uid: string;
  device_mac: string;
  status: string;
  timestamp: string;
}

export async function fetchAttendanceLogs(
  stubCode: string
): Promise<AttendanceLog[]> {
  const { data, error } = await supabase
    .from("attendance_logs")
    .select("*")
    .eq("stub_code", stubCode);

  if (error) throw error;
  return data ?? [];
}
