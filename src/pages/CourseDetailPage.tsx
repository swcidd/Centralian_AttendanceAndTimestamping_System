import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { CgClose, CgArrowLeft, CgChevronRight, CgPen } from "react-icons/cg";

import AddStubcodeModal from "../components/courses/AddStubcodeModal";
import ConfirmDialog from "../components/courses/ConfirmDialog";
import EditStubcodeModal, {
  type ScheduleInput,
  type TerminalInput,
} from "../components/courses/EditStubcodeModal";

import {
  deleteCourse,
  deleteStubcode,
  fetchCourse,
  updateStubcodeSchedule,
  updateStubcodeTerminal,
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
  const [addStubOpen, setAddStubOpen] = useState(false);
  const [editStub, setEditStub] = useState<CourseSection | null>(null);
  const [confirmDeleteStub, setConfirmDeleteStub] = useState<CourseSection | null>(
    null
  );
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState(false);

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

  const handleDeleteStub = async () => {
    if (!confirmDeleteStub) return;
    const section = confirmDeleteStub;
    setConfirmDeleteStub(null);
    setError(null);

    try {
      await deleteStubcode(section);
      loadCourse();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete stubcode."));
    }
  };

  const handleDeleteCourse = async () => {
    if (!course) return;
    setConfirmDeleteCourse(false);
    setError(null);

    try {
      await deleteCourse(course.courseId);
      navigate("/courses");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete course."));
    }
  };

  const handleSaveStub = async (
    section: CourseSection,
    schedule: ScheduleInput,
    terminal: TerminalInput
  ) => {
    setError(null);
    // Apply schedule and terminal independently so an operator can edit
    // one without touching the other.
    await updateStubcodeSchedule(section, schedule);
    await updateStubcodeTerminal(section, terminal.deviceMac, terminal.roomName);
    loadCourse();
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
              onClick={() => setConfirmDeleteCourse(true)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
            >
              Delete course
            </button>
          </div>

          <div className="mt-5 border-t border-tan pt-5">
            <p className="text-navy text-sm font-medium">Instructor</p>
            <p className="text-navy/60 mt-1">{course.instructor}</p>
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
                  <div className="flex items-center gap-3 px-6 py-4">
                    {/* Stubcode identity → masterlist */}
                    <button
                      onClick={() =>
                        navigate(
                          `/courses/${course.courseId}/${sectionKey(section)}`
                        )
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left transition hover:opacity-70"
                      title="View masterlist"
                    >
                      <span className="bg-orange/10 text-orange inline-flex shrink-0 items-center rounded-md px-2.5 py-1 font-mono text-sm font-medium">
                        {section.code}
                      </span>
                      <span className="text-navy/50 shrink-0 text-xs font-semibold uppercase">
                        {TYPE_LABEL[section.type] ?? section.type}
                      </span>
                      <CgChevronRight className="text-navy/30 ml-auto shrink-0" />
                    </button>

                    {/* Per-stubcode schedule + terminal */}
                    <div className="hidden min-w-0 flex-1 sm:block">
                      <p className="text-navy/70 truncate text-sm">
                        {section.schedule}
                      </p>
                      <p className="text-navy/40 truncate text-xs">
                        {section.roomName
                          ? `${section.roomName} · ${section.deviceMac ?? ""}`
                          : "No terminal"}
                      </p>
                    </div>

                    <button
                      onClick={() => setEditStub(section)}
                      aria-label={`Edit stubcode ${sectionLabel(section)}`}
                      title="Edit schedule & terminal"
                      className="text-orange/60 shrink-0 transition hover:text-orange"
                    >
                      <CgPen />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteStub(section)}
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

      {editStub && (
        <EditStubcodeModal
          section={editStub}
          onSave={handleSaveStub}
          onClose={() => setEditStub(null)}
        />
      )}

      {confirmDeleteStub && (
        <ConfirmDialog
          title={`Delete stubcode ${sectionLabel(confirmDeleteStub)}?`}
          message={stubDeleteConfirm(
            sectionLabel(confirmDeleteStub),
            0
          )}
          confirmLabel="Delete stubcode"
          onConfirm={handleDeleteStub}
          onCancel={() => setConfirmDeleteStub(null)}
        />
      )}

      {confirmDeleteCourse && (
        <ConfirmDialog
          title={`Delete course "${course.name}"?`}
          message={courseDeleteConfirm(course.name, 0)}
          confirmLabel="Delete course"
          onConfirm={handleDeleteCourse}
          onCancel={() => setConfirmDeleteCourse(false)}
        />
      )}
    </div>
  );
};

export default CourseDetailPage;
