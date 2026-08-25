import { useEffect, useState } from "react";

import ActivityFilters from "../components/activity/ActivityFilters";
import ActivityGrid from "../components/activity/ActivityGrid";
import ActivityDetails from "../components/activity/ActivityDetails";

import { fetchActivityLog, fetchSessionRoster } from "../services/attendanceApi";
import type { Activity, StudentStatus } from "../types/types";

const ActivityPage = () => {
  const [selectedStub, setSelectedStub] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    null,
  );
  const [students, setStudents] = useState<StudentStatus[]>([]);

  useEffect(() => {
    setSelectedActivityId(null);
    if (!selectedStub) {
      setActivities([]);
      return;
    }
    fetchActivityLog(selectedStub)
      .then(setActivities)
      .catch(() => setActivities([]));
  }, [selectedStub]);

  const selectedActivity = activities.find(
    (activity) => activity.id === selectedActivityId,
  );

  useEffect(() => {
    if (!selectedStub || !selectedActivityId) {
      setStudents([]);
      return;
    }
    fetchSessionRoster(selectedStub, selectedActivityId)
      .then(setStudents)
      .catch(() => setStudents([]));
  }, [selectedStub, selectedActivityId]);

  return (
    <div className="bg-cream min-h-screen p-6">
      <div className="grid gap-6 lg:grid-cols-[180px_1fr_320px]">
        <section>
          <ActivityFilters
            selectedStub={selectedStub}
            onStubChange={setSelectedStub}
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
