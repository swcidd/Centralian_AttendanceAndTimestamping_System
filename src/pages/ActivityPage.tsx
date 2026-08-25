import { useState } from "react";

import ActivityFilters from "../components/activity/ActivityFilters";
import ActivityGrid from "../components/activity/ActivityGrid";
import ActivityDetails from "../components/activity/ActivityDetails";

import { Activity } from "../types/types";

const activities: Activity[] = [
  {
    id: 1,
    date: "August 5, 2026",
    present: 25,
    absent: 3,
    late: 2,
  },
  {
    id: 2,
    date: "August 7, 2026",
    present: 27,
    absent: 2,
    late: 1,
  },
  {
    id: 3,
    date: "August 9, 2026",
    present: 24,
    absent: 4,
    late: 2,
  },
  {
    id: 4,
    date: "August 10, 2026",
    present: 26,
    absent: 2,
    late: 2,
  },
];

const students = [
  {
    id: "1",
    name: "Student #1",
    status: "Present" as const,
  },
  {
    id: "2",
    name: "Student #2",
    status: "Present" as const,
  },
  {
    id: "3",
    name: "Student #3",
    status: "Late" as const,
  },
  {
    id: "4",
    name: "Student #4",
    status: "Absent" as const,
  },
];

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
