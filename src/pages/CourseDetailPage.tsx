import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { CgClose, CgArrowLeft, CgChevronRight } from "react-icons/cg";

import AddStubcodeModal from "../components/courses/AddStubcodeModal";
import AssignTerminalModal from "../components/courses/AssignTerminalModal";

import {
  countAttendance,
  deleteCourse,
  deleteStubcode,
  fetchCourse,
} from "../services/coursesApi";
import { getErrorMessage } from "../lib/errors";
import {
  courseDeleteConfirm,
  stubDeleteConfirm,
} from "../lib/utils/deleteConfirm";
import { sectionLabel, sectionKey } from "../lib/utils/section";
import type { Course, CourseSection } from "../types/types";

const TYPE_LABEL: Record<string, string> = {
  lect: "LEC",
  lab: "LAB",
};

const CourseDetailPage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [addStubOpen, setAddStubOpen] = useState(false);

  const loadCourse = useCallback(() => {
    if (!courseId) return;
    fetchCourse(courseId)
      .then((data) => {
        if (data) {
          setCourse(data);
        } else {
          setNotFound(true);
        }
      })
      .catch((err: unknown) =>
        setError(getErrorMessage(err, "Failed to load course."))
      );
  }, [courseId]);

  useEffect(loadCourse, [loadCourse]);

  const handleDeleteStub = async (section: CourseSection) => {
    if (!course) return;

    // A course is its sections; deleting the last one leaves an empty
    // shell, so steer the operator to delete the course instead.
    if (course.sections.length === 1) {
      setError(
        `"${course.name}" needs at least one section — delete the course instead.`
      );
      return;
    }

    setError(null);

    let attendance: number;
    try {
      attendance = await countAttendance([section]);
    } catch (err) {
      setError(
        getErrorMessage(err, "Failed to check this stubcode's attendance records.")
      );
      return;
    }

    if (!window.confirm(stubDeleteConfirm(sectionLabel(section), attendance))) {
      return;
    }
    try {
      await deleteStubcode(section);
      loadCourse();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete stubcode."));
    }
  };

  const handleDeleteCourse = async () => {
    if (!course) return;
    setError(null);

    let attendance = 0;
    try {
      attendance = await countAttendance(course.sections);
    } catch (err) {
      setError(
        getErrorMessage(err, "Failed to check this course's attendance records.")
      );
      return;
    }

    if (!window.confirm(courseDeleteConfirm(course.name, attendance))) {
      return;
    }
    try {
      await deleteCourse(course.courseId);
      navigate("/courses");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete course."));
    }
  };

  if (notFound) {
    return (
      <div className="bg-cream flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-navy text-lg font-semibold">Course not found</p>
        <button
          onClick={() => navigate("/courses")}
          className="text-orange text-sm font-medium hover:underline"
        >
          &larr; Back to courses
        </button>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="bg-cream flex min-h-screen items-center justify-center">
        <p className="text-navy/60">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-cream min-h-screen p-6">
      <button
        onClick={() => navigate("/courses")}
        className="text-orange mb-4 inline-flex items-center gap-1 text-sm font-medium hover:underline"
      >
        <CgArrowLeft /> Back to courses
      </button>

      <div className="mx-auto max-w-3xl">
        <div className="border-tan rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-navy text-2xl font-bold">{course.name}</h1>
              <p className="text-navy/60 mt-1 text-sm">{course.schedule}</p>
            </div>
            <button
              onClick={handleDeleteCourse}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
            >
              Delete course
            </button>
          </div>

          <div className="mt-5 grid gap-4 border-t border-tan pt-5 sm:grid-cols-2">
            <div>
              <p className="text-navy text-sm font-medium">Instructor</p>
              <p className="text-navy/60 mt-1">{course.instructor}</p>
            </div>
            <div>
              <p className="text-navy text-sm font-medium">Terminal</p>
              {course.deviceMac ? (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-navy/60">
                    {course.roomName ?? "Assigned"}
                    <span className="text-navy/40">
                      {" "}
                      · <span className="font-mono text-xs">{course.deviceMac}</span>
                    </span>
                  </p>
                  <button
                    onClick={() => setAssignOpen(true)}
                    className="text-orange text-xs font-medium transition hover:underline"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAssignOpen(true)}
                  className="text-orange mt-1 text-xs font-medium transition hover:underline"
                >
                  + Assign terminal
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stubcodes */}
        <div className="border-tan mt-6 rounded-xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-tan px-6 py-4">
            <h2 className="text-navy text-lg font-semibold">
              Stubcodes ({course.sections.length})
            </h2>
            <button
              onClick={() => setAddStubOpen(true)}
              className="bg-orange rounded-md px-3 py-1.5 text-xs font-medium text-white transition hover:brightness-95"
            >
              + Add stubcode
            </button>
          </div>

          {error && (
            <p className="border-b border-tan bg-red-50 px-6 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {course.sections.length === 0 ? (
            <p className="text-navy/40 px-6 py-8 text-center text-sm">
              No stubcodes yet — add one to start taking attendance.
            </p>
          ) : (
            <ul className="divide-y divide-tan">
              {course.sections.map((section) => (
                <li key={sectionKey(section)}>
                  <div className="flex items-center justify-between gap-4">
                    <button
                      onClick={() =>
                        navigate(
                          `/courses/${course.courseId}/${sectionKey(section)}`
                        )
                      }
                      className="hover:bg-cream flex flex-1 items-center gap-3 rounded-md px-2 py-2 text-left transition"
                      title="View masterlist"
                    >
                      <span className="bg-orange/10 text-orange inline-flex items-center rounded-md px-2.5 py-1 font-mono text-sm font-medium">
                        {section.code}
                      </span>
                      <span className="text-navy/50 text-xs font-semibold uppercase">
                        {TYPE_LABEL[section.type] ?? section.type}
                      </span>
                      <CgChevronRight className="text-navy/30 ml-auto shrink-0" />
                    </button>
                    <button
                      onClick={() => handleDeleteStub(section)}
                      aria-label={`Delete stubcode ${sectionLabel(section)}`}
                      title="Delete stubcode"
                      className="text-orange/60 shrink-0 transition hover:text-red-600"
                    >
                      <CgClose />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {addStubOpen && (
        <AddStubcodeModal
          course={course}
          onClose={() => setAddStubOpen(false)}
          onAdded={loadCourse}
        />
      )}

      {assignOpen && (
        <AssignTerminalModal
          course={course}
          onClose={() => setAssignOpen(false)}
          onAssigned={loadCourse}
        />
      )}
    </div>
  );
};

export default CourseDetailPage;
