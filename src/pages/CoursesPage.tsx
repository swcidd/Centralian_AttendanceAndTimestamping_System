import { useEffect, useState } from "react";

import CourseToolbar from "../components/courses/CourseToolbar";
import CourseGrid from "../components/courses/CourseGrid";
import StudentTrackTable from "../components/courses/StudentTrackTable";
import AssignTerminalModal from "../components/courses/AssignTerminalModal";

import { deleteCourse, fetchCourses } from "../services/coursesApi";
import { getErrorMessage } from "../lib/errors";
import { matchesCourseSearch } from "../lib/utils/courseSearch";
import AddStubcodeModal from "../components/courses/AddStubcodeModal";
import type { Course } from "../types/types";

const CoursesPage = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [assignCourse, setAssignCourse] = useState<Course | null>(null);
  const [stubCourse, setStubCourse] = useState<Course | null>(null);

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
    const label = course ? course.name : "this course";
    if (!window.confirm(`Delete course ${label}? This can't be undone.`)) {
      return;
    }
    setError(null);
    try {
      await deleteCourse(courseId);
      loadCourses();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete course."));
    }
  };

  const handleAssign = (courseId: string) => {
    const course = courses.find((c) => c.courseId === courseId);
    if (course) setAssignCourse(course);
  };

  const handleAddStub = (courseId: string) => {
    const course = courses.find((c) => c.courseId === courseId);
    if (course) setStubCourse(course);
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
                onAddStub={handleAddStub}
                onAssign={handleAssign}
                onDelete={handleDelete}
              />
            </div>
          </div>
        </section>
        <section className="min-w-0">
          <StudentTrackTable />
        </section>
      </div>

      {assignCourse && (
        <AssignTerminalModal
          course={assignCourse}
          onClose={() => setAssignCourse(null)}
          onAssigned={loadCourses}
        />
      )}

      {stubCourse && (
        <AddStubcodeModal
          course={stubCourse}
          onClose={() => setStubCourse(null)}
          onAdded={loadCourses}
        />
      )}
    </div>
  );
};

export default CoursesPage;
