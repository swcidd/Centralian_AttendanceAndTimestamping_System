import { useEffect, useState } from "react";

import { fetchCourses } from "../../services/coursesApi";
import type { Course } from "../../types/types";

interface TrackingFiltersProps {
  onCourseSelect: (course: Course | null) => void;
}

const TrackingFilters = ({ onCourseSelect }: TrackingFiltersProps) => {
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    fetchCourses()
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const course = courses.find((c) => c.stub === e.target.value) ?? null;
    onCourseSelect(course);
  };

  return (
    <div className="flex gap-4">
      <select
        onChange={handleChange}
        defaultValue=""
        className="border-tan text-navy focus:border-orange focus:ring-orange/20 rounded-lg border bg-white px-4 py-2.5 outline-none focus:ring-2"
      >
        <option value="" disabled>
          Course
        </option>
        {courses.map((course) => (
          <option key={course.stub} value={course.stub}>
            {course.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TrackingFilters;
