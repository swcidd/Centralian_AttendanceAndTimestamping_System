import { supabase } from "../lib/supabase";

export interface AttendanceLog {
  Log_ID: string;
  Session_ID: string;
  Student_ID: string;
  Stub_Code: string;
  NFC_UID: string;
  Device_MAC: string;
  Status: string;
  Timestamp: string;
}

export async function fetchAttendanceLogs(
  stubCode: string
): Promise<AttendanceLog[]> {
  const { data, error } = await supabase
    .from("Attendance_Logs")
    .select("*")
    .eq("Stub_Code", stubCode);

  if (error) throw error;
  return data ?? [];
}
