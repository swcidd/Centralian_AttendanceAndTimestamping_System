import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import CourseToolbar from "../components/courses/CourseToolbar";
import CourseGrid from "../components/courses/CourseGrid";
import StudentTrackTable from "../components/courses/StudentTrackTable";
import ConfirmDialog from "../components/courses/ConfirmDialog";

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
  const [pendingDelete, setPendingDelete] = useState<{
    courseId: string;
    name: string;
    attendance: number;
  } | null>(null);

  const loadCourses = useCallback(() => {
    fetchCourses()
      .then(setCourses)
      .catch((err: unknown) =>
        setError(getErrorMessage(err, "Failed to load courses."))
      );
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  // Count first so the confirmation names exactly what will be dropped.
  const requestDelete = async (courseId: string) => {
    const course = courses.find((c) => c.courseId === courseId);
    setError(null);

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

    setPendingDelete({
      courseId,
      name: course ? course.name : "this course",
      attendance,
    });
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const { courseId } = pendingDelete;
    setPendingDelete(null);

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
      <div className="grid gap-6 lg:grid-cols-[1fr 420px]">
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
                onDelete={requestDelete}
              />
            </div>
          </div>
        </section>
        <section className="min-w-0">
          <StudentTrackTable />
        </section>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete course "${pendingDelete.name}"?`}
          message={courseDeleteConfirm(
            pendingDelete.name,
            pendingDelete.attendance
          )}
          confirmLabel="Delete course"
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
};

export default CoursesPage;
