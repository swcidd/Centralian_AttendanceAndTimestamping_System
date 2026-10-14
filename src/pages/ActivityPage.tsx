import { useEffect, useState } from "react";

import ActivityFilters from "../components/activity/ActivityFilters";
import ActivityGrid from "../components/activity/ActivityGrid";
import ActivityDetails from "../components/activity/ActivityDetails";

import { fetchActivityLog, fetchSessionRoster } from "../services/attendanceApi";
import { sectionKey } from "../lib/utils/section";
import type { Activity, CourseSection, StudentStatus } from "../types/types";

const ActivityPage = () => {
  const [selectedSection, setSelectedSection] = useState<CourseSection | null>(
    null
  );
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    null,
  );
  const [students, setStudents] = useState<StudentStatus[]>([]);

  const sectionId = selectedSection ? sectionKey(selectedSection) : null;

  // Reset during render (not in an effect) so switching sections clears the
  // previous section's list and selection before the new fetch resolves,
  // instead of showing stale data for a frame.
  const [trackedKey, setTrackedKey] = useState<string | null>(null);
  if (sectionId !== trackedKey) {
    setTrackedKey(sectionId);
    setSelectedActivityId(null);
    setActivities([]);
    setStudents([]);
  }

  useEffect(() => {
    if (!selectedSection) return;
    fetchActivityLog(selectedSection)
      .then(setActivities)
      .catch(() => setActivities([]));
  }, [selectedSection]);

  const selectedActivity = activities.find(
    (activity) => activity.id === selectedActivityId,
  );

  useEffect(() => {
    if (!selectedSection || !selectedActivityId) return;
    fetchSessionRoster(selectedSection, selectedActivityId)
      .then(setStudents)
      .catch(() => setStudents([]));
  }, [selectedSection, selectedActivityId]);

  return (
    <div className="bg-cream min-h-screen p-6">
      <div className="grid gap-6 lg:grid-cols-[180px_1fr_320px]">
        <section>
          <ActivityFilters
            onFilterChange={(_, section) => setSelectedSection(section)}
          />
        </section>
        <section>
          <ActivityGrid
            activities={activities}
            onActivitySelect={setSelectedActivityId}
          />
        </section>
        <section className="border-tan lg:border-l lg:pl-6">
          {selectedActivity ? (
            <ActivityDetails date={selectedActivity.date} students={students} />
          ) : (
            <div className="border-tan flex min-h-40 items-center justify-center rounded-xl border bg-white p-6 text-center shadow-sm">
              <p className="text-navy/60 font-medium">Select a Date</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ActivityPage;
