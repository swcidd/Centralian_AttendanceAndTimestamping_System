import { useEffect, useMemo, useState } from "react";

import TrackingFilters from "../components/tracking/TrackingFilters";
import TrackingTable from "../components/tracking/TrackingTable";
import TrackingButton from "../components/tracking/TrackingButton";

import { getActiveSession, type ActiveSession } from "../services/sessionsApi";
import { DB_STATUS_TO_UI, fetchSessionRoster } from "../services/attendanceApi";
import { useRealtimeAttendance } from "../hooks/useRealtimeAttendance";
import { supabase } from "../lib/supabase";
import { attendanceReducer, type RosterState } from "../lib/utils/attendanceReducer";

import type { Course, StudentStatus } from "../types/types";

const TrackingPage = () => {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(
    null
  );
  const [baseRoster, setBaseRoster] = useState<StudentStatus[]>([]);

  // Reset during render (not in an effect) so switching courses clears
  // the previous course's roster/session before the new fetch resolves,
  // instead of showing stale data for a frame.
  const [trackedCourseStub, setTrackedCourseStub] = useState<string | null>(
    null
  );
  if ((selectedCourse?.stub ?? null) !== trackedCourseStub) {
    setTrackedCourseStub(selectedCourse?.stub ?? null);
    setActiveSession(null);
    setBaseRoster([]);
  }

  const sessionId = activeSession?.sessionId ?? null;

  // The active session for the selected course — TrackingButton reports
  // changes back into this via onSessionChange (starts/stops), but a
  // course switch needs its own lookup since no click triggered it.
  useEffect(() => {
    if (!selectedCourse) return;

    let cancelled = false;
    getActiveSession(selectedCourse.stub)
      .then((session) => {
        if (!cancelled) setActiveSession(session);
      })
      .catch(() => {
        if (!cancelled) setActiveSession(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCourse]);

  // The base roster (every enrolled student) plus whatever status the
  // open session's Attendance_Logs already carry.
  const loadRoster = useMemo(
    () => () => {
      if (!selectedCourse) return;
      fetchSessionRoster(selectedCourse.stub, sessionId)
        .then(setBaseRoster)
        .catch(() => setBaseRoster([]));
    },
    [selectedCourse, sessionId]
  );

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // Registration mode has no per-tap attendance_logs row (see ingest-tap's
  // REGISTRATION branch) — instead each tap creates a Students +
  // Enrollments row. Re-running the same roster fetch on every new
  // enrollment turns the existing table into a live registration list for
  // free, without a second parallel data structure.
  useEffect(() => {
    if (!selectedCourse || activeSession?.status !== "REGISTRATION") return;

    const channel = supabase
      .channel(`enrollments:${selectedCourse.stub}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "enrollments",
          filter: `stub_code=eq.${selectedCourse.stub}`,
        },
        () => loadRoster()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCourse, activeSession?.status, loadRoster]);

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

  const needsCalibration =
    selectedCourse !== null && !activeSession && baseRoster.length === 0;

  return (
    <div className="bg-cream min-h-screen space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <TrackingFilters onCourseSelect={setSelectedCourse} />
        <TrackingButton
          key={selectedCourse?.stub ?? "none"}
          course={selectedCourse}
          activeSession={activeSession}
          onSessionChange={setActiveSession}
        />
      </div>

      {needsCalibration ? (
        <div className="border-tan flex flex-col items-center gap-2 rounded-xl border bg-white p-12 text-center shadow-sm">
          <p className="text-navy font-medium">
            No students enrolled in this course yet.
          </p>
          <p className="text-navy/60 max-w-sm text-sm">
            Pick Start Registration above and have students tap their cards
            to populate the masterlist.
          </p>
        </div>
      ) : (
        <TrackingTable students={students} />
      )}
    </div>
  );
};

export default TrackingPage;
