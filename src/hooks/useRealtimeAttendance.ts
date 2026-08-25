import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { AttendanceLog } from "../services/attendanceApi";

// Streams new Attendance_Logs rows for one Active_Session (a tap, or the
// finalize_absences() cron closing it out). No subscription while a
// session isn't open yet.
export function useRealtimeAttendance(sessionId: string | null) {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);

  // Reset during render (not in the effect below) so a session switch
  // drops the old session's taps immediately instead of via a callback.
  const [trackedSessionId, setTrackedSessionId] = useState(sessionId);
  if (sessionId !== trackedSessionId) {
    setTrackedSessionId(sessionId);
    setLogs([]);
  }

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`attendance-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendance_logs",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setLogs((current) => [...current, payload.new as AttendanceLog]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return logs;
}
