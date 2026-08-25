import { useEffect, useMemo, useState } from "react";

import TrackingFilters from "../components/tracking/TrackingFilters";
import TrackingTable from "../components/tracking/TrackingTable";
import TrackingButton from "../components/tracking/TrackingButton";

import { getActiveSession } from "../services/sessionsApi";
import { DB_STATUS_TO_UI, fetchSessionRoster } from "../services/attendanceApi";
import { useRealtimeAttendance } from "../hooks/useRealtimeAttendance";
import { attendanceReducer, type RosterState } from "../lib/utils/attendanceReducer";

import type { Course, StudentStatus } from "../types/types";

const TrackingPage = () => {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [baseRoster, setBaseRoster] = useState<StudentStatus[]>([]);

  // Reset during render (not in an effect) so switching courses clears
  // the previous course's roster/session before the new fetch resolves,
  // instead of showing stale data for a frame.
  const [trackedCourseStub, setTrackedCourseStub] = useState<string | null>(
    null
  );
  if ((selectedCourse?.stub ?? null) !== trackedCourseStub) {
    setTrackedCourseStub(selectedCourse?.stub ?? null);
    setSessionId(null);
    setBaseRoster([]);
  }

  // The active session for the selected course — TrackingButton reports
  // changes back into this via onSessionChange (starts/stops), but a
  // course switch needs its own lookup since no click triggered it.
  useEffect(() => {
    if (!selectedCourse) return;

    let cancelled = false;
    getActiveSession(selectedCourse.stub)
      .then((session) => {
        if (!cancelled) setSessionId(session?.sessionId ?? null);
      })
      .catch(() => {
        if (!cancelled) setSessionId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCourse]);

  // The base roster (every enrolled student) plus whatever status the
  // open session's Attendance_Logs already carry.
  useEffect(() => {
    if (!selectedCourse) return;

    let cancelled = false;
    fetchSessionRoster(selectedCourse.stub, sessionId)
      .then((roster) => {
        if (!cancelled) setBaseRoster(roster);
      })
      .catch(() => {
        if (!cancelled) setBaseRoster([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCourse, sessionId]);

  // Live taps stream in via realtime; fold them onto the base roster
  // through the pure reducer rather than re-fetching per tap. Folding
  // the whole array (not just the newest entry) keeps this correct even
  // when several taps land in the same render batch.
  const taps = useRealtimeAttendance(sessionId);
  const students = useMemo(() => {
    let state: RosterState = { students: baseRoster };
    for (const tap of taps) {
      if (!tap.student_id) continue;
      state = attendanceReducer(state, {
        studentId: tap.student_id,
        timestamp: tap.timestamp,
        status: DB_STATUS_TO_UI[tap.status as "PRESENT" | "LATE" | "ABSENT"],
      });
    }
    return state.students as StudentStatus[];
  }, [baseRoster, taps]);

  return (
    <div className="bg-cream min-h-screen space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <TrackingFilters onCourseSelect={setSelectedCourse} />
        <TrackingButton
          key={selectedCourse?.stub ?? "none"}
          course={selectedCourse}
          sessionId={sessionId}
          onSessionChange={setSessionId}
        />
      </div>

      <TrackingTable students={students} />
    </div>
  );
};

export default TrackingPage;
