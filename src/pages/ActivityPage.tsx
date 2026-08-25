import { useState } from "react";

import ActivityFilters from "../components/activity/ActivityFilters";
import ActivityGrid from "../components/activity/ActivityGrid";
import ActivityDetails from "../components/activity/ActivityDetails";

import { Activity, StudentStatus } from "../types/types";

const activities: Activity[] = [];

const students: StudentStatus[] = [];

const ActivityPage = () => {
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(
    null,
  );

  const selectedActivity = activities.find(
    (activity) => activity.id === selectedActivityId,
  );

  return (
    <div className="bg-cream min-h-screen p-6">
      <div className="grid gap-6 lg:grid-cols-[180px_1fr_320px]">
        <section>
          <ActivityFilters />
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
