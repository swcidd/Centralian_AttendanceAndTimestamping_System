import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { CgArrowLeft, CgUser } from "react-icons/cg";

import { fetchSessionRoster } from "../services/attendanceApi";
import { getErrorMessage } from "../lib/errors";
import type { StudentStatus } from "../types/types";

const TYPE_LABEL: Record<string, string> = {
  lect: "Lecture",
  lab: "Laboratory",
};

const StubcodeMasterlistPage = () => {
  const { courseId, sectionKey } = useParams<{
    courseId: string;
    sectionKey: string;
  }>();
  const navigate = useNavigate();

  const [students, setStudents] = useState<StudentStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [code, type] = sectionKey?.split("|") ?? [];
  const invalid = !code || (type !== "lect" && type !== "lab");
  const typeLabel = TYPE_LABEL[type ?? ""] ?? type ?? "";
  const errorMessage = invalid ? "Invalid stubcode." : error;

  // Reset loading when the URL's stubcode changes (render-time, not in an
  // effect) so the spinner shows immediately on navigation.
  const [trackedKey, setTrackedKey] = useState<string | null>(null);
  if (sectionKey !== trackedKey) {
    setTrackedKey(sectionKey ?? null);
    setLoading(true);
  }

  useEffect(() => {
    if (invalid) return;
    fetchSessionRoster({ code, type: type as "lect" | "lab" }, null)
      .then(setStudents)
      .catch((err: unknown) =>
        setError(getErrorMessage(err, "Failed to load masterlist."))
      )
      .finally(() => setLoading(false));
  }, [invalid, code, type]);

  return (
    <div className="bg-cream min-h-screen p-6">
      <button
        onClick={() =>
          courseId ? navigate(`/courses/${courseId}`) : navigate("/courses")
        }
        className="text-orange mb-5 inline-flex items-center gap-1.5 text-sm font-semibold transition hover:underline"
      >
        <CgArrowLeft /> Back to course
      </button>

      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="border-tan rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-orange/10 text-orange flex h-12 w-12 items-center justify-center rounded-xl font-mono text-lg font-bold">
              {code}
            </div>
            <div>
              <h1 className="text-navy text-2xl font-bold tracking-tight">
                Masterlist
              </h1>
              <p className="text-navy/60 mt-0.5 text-sm font-medium">
                {typeLabel} · Stubcode {code}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-navy text-3xl font-bold">{students.length}</p>
              <p className="text-navy/50 text-xs font-medium uppercase tracking-wide">
                Enrolled
              </p>
            </div>
          </div>
        </div>

        {/* Student list */}
        <div className="border-tan mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm">
          {errorMessage && (
            <p className="border-b border-tan bg-red-50 px-6 py-3 text-sm text-red-600">
              {errorMessage}
            </p>
          )}

          {invalid ? null : loading ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange border-t-transparent" />
              <p className="text-navy/50 text-sm">Loading masterlist...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16">
              <div className="bg-orange/10 text-orange flex h-14 w-14 items-center justify-center rounded-full">
                <CgUser className="h-7 w-7" />
              </div>
              <p className="text-navy font-medium">No students yet</p>
              <p className="text-navy/50 text-center text-sm">
                Students will appear here once they tap their cards in
                registration mode.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-tan">
              {students.map((student, i) => (
                <li
                  key={student.id}
                  className="group flex items-center gap-4 px-6 py-3.5 transition hover:bg-cream"
                >
                  <span className="text-navy/30 w-7 text-right font-mono text-xs font-medium">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="bg-orange/10 text-orange flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                    <CgUser className="h-4 w-4" />
                  </div>
                  <span className="text-navy group-hover:text-orange flex-1 text-sm font-medium transition">
                    {student.name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default StubcodeMasterlistPage;
