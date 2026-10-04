import { useEffect, useState } from "react";

import { fetchCourses } from "../../services/coursesApi";
import type { Course } from "../../types/types";

interface ActivityFiltersProps {
  // Same cascading contract as TrackingFilters: course and stubcode
  // are emitted together, with the course's first stubcode picked
  // automatically on course selection.
  onFilterChange: (course: Course | null, stub: string | null) => void;
}

// Course -> Stubcode cascade (a course owns many stubcodes). Until a
// course is chosen the stub dropdown is disabled and empty — no more
// two dropdowns listing the same courses side by side.
const ActivityFilters = ({ onFilterChange }: ActivityFiltersProps) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedStub, setSelectedStub] = useState("");

  useEffect(() => {
    fetchCourses()
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);

  const selectedCourse =
    courses.find((course) => course.courseId === selectedCourseId) ?? null;

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const course =
      courses.find((c) => c.courseId === e.target.value) ?? null;
    const stub = course?.stubs[0] ?? null;
    setSelectedCourseId(e.target.value);
    setSelectedStub(stub ?? "");
    onFilterChange(course, stub);
  };

  const handleStubChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStub(e.target.value);
    onFilterChange(selectedCourse, e.target.value || null);
  };

  const selectClass =
    "border-tan text-navy focus:border-orange focus:ring-orange/20 w-full rounded-lg border bg-white px-4 py-2.5 outline-none focus:ring-2";

  return (
    <div className="flex flex-col gap-3">
      <select
        value={selectedCourseId}
        onChange={handleCourseChange}
        className={selectClass}
      >
        <option value="" disabled>
          Course
        </option>
        {courses.map((course) => (
          <option key={course.courseId} value={course.courseId}>
            {course.name}
          </option>
        ))}
      </select>
      <select
        value={selectedStub}
        onChange={handleStubChange}
        disabled={!selectedCourse}
        className={selectClass}
      >
        <option value="" disabled>
          Stub Code
        </option>
        {(selectedCourse?.stubs ?? []).map((stub) => (
          <option key={stub} value={stub}>
            {stub}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ActivityFilters;
