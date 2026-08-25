import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { AttendanceLog } from "../services/attendanceApi";

export function useRealtimeAttendance(stubCode: string) {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel(`attendance-${stubCode}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendance_logs",
          filter: `stub_code=eq.${stubCode}`,
        },
        (payload) => {
          setLogs((current) => [...current, payload.new as AttendanceLog]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [stubCode]);

  return logs;
}
