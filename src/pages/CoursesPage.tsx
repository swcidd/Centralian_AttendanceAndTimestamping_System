import { useEffect, useState } from "react";

import CourseToolbar from "../components/courses/CourseToolbar";
import CourseGrid from "../components/courses/CourseGrid";
import StudentTrackTable from "../components/courses/StudentTrackTable";

import { deleteCourse, fetchCourses } from "../services/coursesApi";
import { getErrorMessage } from "../lib/errors";
import type { Course } from "../types/types";

const CoursesPage = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadCourses = () => {
    fetchCourses()
      .then(setCourses)
      .catch((err: unknown) =>
        setError(getErrorMessage(err, "Failed to load courses."))
      );
  };

  useEffect(loadCourses, []);

  const handleDelete = async (stub: string) => {
    if (!window.confirm(`Delete course ${stub}? This can't be undone.`)) {
      return;
    }
    setError(null);
    try {
      await deleteCourse(stub);
      loadCourses();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete course."));
    }
  };

  return (
    <div className="bg-cream min-h-screen p-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="min-w-0">
          <div className="border-tan overflow-hidden rounded-xl border bg-white shadow-sm">
            <CourseToolbar onCourseAdded={loadCourses} />
            <div className="p-5">
              {error && (
                <p className="mb-4 text-sm text-red-600">{error}</p>
              )}
              <CourseGrid courses={courses} onDelete={handleDelete} />
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
