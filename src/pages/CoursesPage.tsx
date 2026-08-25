import { useEffect, useState } from "react";

import CourseToolbar from "../components/courses/CourseToolbar";
import CourseGrid from "../components/courses/CourseGrid";
import StudentTrackTable from "../components/courses/StudentTrackTable";

import { fetchCourses } from "../services/coursesApi";
import type { Course } from "../types/types";

const CoursesPage = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCourses()
      .then(setCourses)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="bg-cream min-h-screen p-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="min-w-0">
          <div className="border-tan overflow-hidden rounded-xl border bg-white shadow-sm">
            <CourseToolbar />
            <div className="p-5">
              {error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : (
                <CourseGrid courses={courses} />
              )}
            </div>
          </div>
        </section>
        <section className="min-w-0">
          <StudentTrackTable />
        </section>
      </div>
    </div>
  );
};

export default CoursesPage;
