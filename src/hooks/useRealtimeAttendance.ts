import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { AttendanceLog } from "../services/attendanceApi";

interface AttendanceRow {
  attendance_id: string;
  session_id: string;
  enrollment_id: string;
  course_stubcode: number;
  status: string;
  attendance_timestamp: string | null;
}

function statusToLog(status: string): AttendanceLog["status"] {
  if (status === "present") return "PRESENT";
  if (status === "late") return "LATE";
  if (status === "excused") return "UNKNOWN";
  return "ABSENT";
}

// Streams attendance changes for one open session. A tap is an UPDATE of
// a pre-generated absent row (ingest-tap never inserts attendance), so
// this listens to every event and filters on the timestamp instead of
// assuming only INSERTs are taps. No subscription while a session isn't
// open yet.
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

    const handleRow = (row: AttendanceRow) => {
      // Only a physical tap stamps a timestamp; the blanket absent rows
      // carry null and are not taps.
      if (!row.attendance_timestamp) return;

      const log: AttendanceLog = {
        log_id: row.attendance_id,
        session_id: row.session_id,
        student_id: null,
        stub_code: String(row.course_stubcode),
        nfc_uid: null,
        device_mac: null,
        status: statusToLog(row.status),
        timestamp: row.attendance_timestamp,
      };

      // attendance carries enrollment_id, not student_id; resolve the
      // student so TrackingPage's reducer can fold the tap onto the
      // roster row it already has.
      supabase
        .from("enrollments")
        .select("student_id")
        .eq("enrollment_id", row.enrollment_id)
        .single()
        .then(({ data }) => {
          if (data?.student_id) log.student_id = data.student_id as string;
          setLogs((current) => [...current, log]);
        });
    };

    const channel = supabase
      .channel(`attendance-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => handleRow(payload.new as AttendanceRow)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return logs;
}
