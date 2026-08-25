import { useState } from "react";

import TrackingFilters from "../components/tracking/TrackingFilters";
import TrackingTable from "../components/tracking/TrackingTable";
import TrackingButton from "../components/tracking/TrackingButton";

import type { Course, StudentStatus } from "../types/types";

const students: StudentStatus[] = [];

const TrackingPage = () => {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  return (
    <div className="bg-cream min-h-screen space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <TrackingFilters onCourseSelect={setSelectedCourse} />
        <TrackingButton key={selectedCourse?.stub ?? "none"} course={selectedCourse} />
      </div>

      <TrackingTable students={students} />
    </div>
  );
};

export default TrackingPage;
