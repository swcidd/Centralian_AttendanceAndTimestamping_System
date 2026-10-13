import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import CourseToolbar from "../components/courses/CourseToolbar";
import CourseGrid from "../components/courses/CourseGrid";
import StudentTrackTable from "../components/courses/StudentTrackTable";

import {
  countAttendance,
  deleteCourse,
  fetchCourses,
} from "../services/coursesApi";
import { getErrorMessage } from "../lib/errors";
import { matchesCourseSearch } from "../lib/utils/courseSearch";
import { courseDeleteConfirm } from "../lib/utils/deleteConfirm";
import type { Course } from "../types/types";

const CoursesPage = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");


  const loadCourses = () => {
    fetchCourses()
      .then(setCourses)
      .catch((err: unknown) =>
        setError(getErrorMessage(err, "Failed to load courses."))
      );
  };

  useEffect(loadCourses, []);

  const handleDelete = async (courseId: string) => {
    const course = courses.find((c) => c.courseId === courseId);
    setError(null);

    // Count first so the confirmation names exactly what will be
    // dropped — the cascade deletes these rows before the course.
    let attendance = 0;
    if (course) {
      try {
        attendance = await countAttendance(course.sections);
      } catch (err) {
        setError(
          getErrorMessage(err, "Failed to check this course's attendance records.")
        );
        return;
      }
    }

    const label = course ? course.name : "this course";
    if (!window.confirm(courseDeleteConfirm(label, attendance))) {
      return;
    }
    try {
      await deleteCourse(courseId);
      loadCourses();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete course."));
    }
  };

  const filteredCourses = courses.filter(matchesCourseSearch(searchTerm));

  return (
    <div className="bg-cream min-h-screen p-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="min-w-0">
          <div className="border-tan overflow-hidden rounded-xl border bg-white shadow-sm">
            <CourseToolbar
              onCourseAdded={loadCourses}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
            <div className="p-5">
              {error && (
                <p className="mb-4 text-sm text-red-600">{error}</p>
              )}
              <CourseGrid
                courses={filteredCourses}
                onOpenCourse={(courseId) => navigate(`/courses/${courseId}`)}
                onDelete={handleDelete}
              />
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
