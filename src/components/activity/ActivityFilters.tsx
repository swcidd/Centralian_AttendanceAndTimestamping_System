import { useEffect, useState } from "react";

import { fetchCourses } from "../../services/coursesApi";
import type { Course } from "../../types/types";

const ActivityFilters = () => {
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    fetchCourses()
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <select className="border-tan text-navy focus:border-orange focus:ring-orange/20 w-full rounded-lg border bg-white px-4 py-2.5 outline-none focus:ring-2">
        <option value="" disabled>
          Course
        </option>
        {courses.map((course) => (
          <option key={course.stub} value={course.stub}>
            {course.name}
          </option>
        ))}
      </select>
      <select className="border-tan text-navy focus:border-orange focus:ring-orange/20 w-full rounded-lg border bg-white px-4 py-2.5 outline-none focus:ring-2">
        <option value="" disabled>
          Stub Code
        </option>
        {courses.map((course) => (
          <option key={course.stub} value={course.stub}>
            {course.stub}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ActivityFilters;
