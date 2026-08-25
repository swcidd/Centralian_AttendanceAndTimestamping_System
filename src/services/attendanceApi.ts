import { supabase } from "../lib/supabase";

export interface AttendanceLog {
  log_id: string;
  session_id: string;
  student_id: string | null;
  stub_code: string;
  // Null for ABSENT rows, which are auto-written by finalize_absences()
  // with no physical tap behind them.
  nfc_uid: string | null;
  device_mac: string | null;
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
