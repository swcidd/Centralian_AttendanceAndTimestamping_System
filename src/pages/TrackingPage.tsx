import { useEffect, useMemo, useState } from "react";

import TrackingFilters from "../components/tracking/TrackingFilters";
import TrackingTable from "../components/tracking/TrackingTable";
import TrackingButton from "../components/tracking/TrackingButton";

import { getActiveSession, type ActiveSession } from "../services/sessionsApi";
import { fetchSessionRoster } from "../services/attendanceApi";
import { useRealtimeAttendance } from "../hooks/useRealtimeAttendance";
import { supabase } from "../lib/supabase";
import { attendanceReducer, type RosterState } from "../lib/utils/attendanceReducer";
import { sectionKey } from "../lib/utils/section";

import type { Course, CourseSection, StudentStatus } from "../types/types";

// Local copy of the DB→UI status map. attendanceApi's `DB_STATUS_TO_UI`
// export was dropped in the schema refactor; the mapping is unchanged.
const DB_STATUS_TO_UI = {
  PRESENT: "Present",
  LATE: "Late",
  ABSENT: "Absent",
} as const;

const TrackingPage = () => {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  // Sessions, rosters, and enrollment streams are all scoped to a
  // section now (a course owns many of them), so tracking state keys
  // off the selected section rather than the course.
  const [selectedSection, setSelectedSection] = useState<CourseSection | null>(
    null
  );
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(
    null
  );
  const [baseRoster, setBaseRoster] = useState<StudentStatus[]>([]);

  const selectedKey = selectedSection ? sectionKey(selectedSection) : null;

  // Reset during render (not in an effect) so switching sections
  // clears the previous section's roster/session before the new fetch
  // resolves, instead of showing stale data for a frame.
  const [trackedKey, setTrackedKey] = useState<string | null>(null);
  if (selectedKey !== trackedKey) {
    setTrackedKey(selectedKey);
    setActiveSession(null);
    setBaseRoster([]);
  }

  const sessionId = activeSession?.sessionId ?? null;

  // The active session for the selected section — TrackingButton
  // reports changes back into this via onSessionChange (starts/stops),
  // but a section switch needs its own lookup since no click triggered it.
  useEffect(() => {
    if (!selectedSection) return;

    let cancelled = false;
    getActiveSession(selectedSection)
      .then((session) => {
        if (!cancelled) setActiveSession(session);
      })
      .catch(() => {
        if (!cancelled) setActiveSession(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSection]);

  // The base roster (every student enrolled in the section) plus
  // whatever status the open session's Attendance_Logs already carry.
  const loadRoster = useMemo(
    () => () => {
      if (!selectedSection) return;
      fetchSessionRoster(selectedSection, sessionId)
        .then(setBaseRoster)
        .catch(() => setBaseRoster([]));
    },
    [selectedSection, sessionId]
  );

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // Enrolment taps write no attendance row (see ingest-tap's enroll
  // branch) — each creates a Students + Enrollments row instead.
  // Re-running the same roster fetch on every new enrollment turns the
  // existing table into a live registration list for free, without a
  // second parallel data structure. The filter is on the stubcode alone
  // (Postgres changes take a single column), so a tap in the sibling
  // type sharing the number just triggers a harmless refetch.
  useEffect(() => {
    if (!selectedSection || activeSession?.status !== "REGISTRATION") return;

    const channel = supabase
      .channel(`enrollments:${sectionKey(selectedSection)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "enrollments",
          filter: `course_stubcode=eq.${selectedSection.code}`,
        },
        () => loadRoster()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSection, activeSession?.status, loadRoster]);

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
    selectedSection !== null && !activeSession && baseRoster.length === 0;

  return (
    <div className="bg-cream min-h-screen space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <TrackingFilters
          onFilterChange={(course, section) => {
            setSelectedCourse(course);
            setSelectedSection(section);
          }}
        />
        <TrackingButton
          key={selectedKey ?? "none"}
          course={selectedCourse}
          section={selectedSection}
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
