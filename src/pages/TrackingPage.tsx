import { useEffect, useMemo, useState } from "react";

import TrackingFilters from "../components/tracking/TrackingFilters";
import TrackingTable from "../components/tracking/TrackingTable";
import TrackingButton from "../components/tracking/TrackingButton";

import { getActiveSession, type ActiveSession } from "../services/sessionsApi";
import { fetchSessionRoster } from "../services/attendanceApi";
import { useRealtimeAttendance } from "../hooks/useRealtimeAttendance";
import { supabase } from "../lib/supabase";
import { foldLiveTaps } from "../lib/utils/rosterPipeline";

import type { Course, StudentStatus } from "../types/types";

const TrackingPage = () => {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  // Sessions, rosters, and enrollment streams are all scoped to a
  // stubcode now (a course owns many of them), so tracking state keys
  // off the selected stub rather than the course.
  const [selectedStub, setSelectedStub] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(
    null
  );
  const [baseRoster, setBaseRoster] = useState<StudentStatus[]>([]);

  // Reset during render (not in an effect) so switching stubcodes
  // clears the previous stub's roster/session before the new fetch
  // resolves, instead of showing stale data for a frame.
  const [trackedStub, setTrackedStub] = useState<string | null>(null);
  if (selectedStub !== trackedStub) {
    setTrackedStub(selectedStub);
    setActiveSession(null);
    setBaseRoster([]);
  }

  const sessionId = activeSession?.sessionId ?? null;

  // The active session for the selected stubcode — TrackingButton
  // reports changes back into this via onSessionChange (starts/stops),
  // but a stub switch needs its own lookup since no click triggered it.
  useEffect(() => {
    if (!selectedStub) return;

    let cancelled = false;
    getActiveSession(selectedStub)
      .then((session) => {
        if (!cancelled) setActiveSession(session);
      })
      .catch(() => {
        if (!cancelled) setActiveSession(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStub]);

  // The base roster (every student enrolled in the stubcode) plus
  // whatever status the open session's Attendance_Logs already carry.
  const loadRoster = useMemo(
    () => () => {
      if (!selectedStub) return;
      fetchSessionRoster(selectedStub, sessionId)
        .then(setBaseRoster)
        .catch(() => setBaseRoster([]));
    },
    [selectedStub, sessionId]
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
    if (!selectedStub || activeSession?.status !== "REGISTRATION") return;

    const channel = supabase
      .channel(`enrollments:${selectedStub}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "enrollments",
          filter: `stub_code=eq.${selectedStub}`,
        },
        () => loadRoster()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedStub, activeSession?.status, loadRoster]);

  // Live taps stream in via realtime; fold them onto the base roster
  // through the pure tap pipeline rather than re-fetching per tap.
  const taps = useRealtimeAttendance(sessionId);
  const students = useMemo(
    () => foldLiveTaps(baseRoster, taps) as StudentStatus[],
    [baseRoster, taps]
  );

  const needsCalibration =
    selectedStub !== null && !activeSession && baseRoster.length === 0;

  return (
    <div className="bg-cream min-h-screen space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <TrackingFilters
          onFilterChange={(course, stub) => {
            setSelectedCourse(course);
            setSelectedStub(stub);
          }}
        />
        <TrackingButton
          key={selectedStub ?? "none"}
          course={selectedCourse}
          stub={selectedStub}
          activeSession={activeSession}
          onSessionChange={setActiveSession}
        />
      </div>

      {needsCalibration ? (
        <div className="border-tan flex flex-col items-center gap-2 rounded-xl border bg-white p-12 text-center shadow-sm">
          <p className="text-navy font-medium">
            No students enrolled in this stubcode yet.
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
