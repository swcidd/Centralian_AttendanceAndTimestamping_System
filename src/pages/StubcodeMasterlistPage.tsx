import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { CgArrowLeft } from "react-icons/cg";

import { fetchSessionRoster } from "../services/attendanceApi";
import { getErrorMessage } from "../lib/errors";
import type { StudentStatus } from "../types/types";

const StubcodeMasterlistPage = () => {
  const { courseId, sectionKey } = useParams<{
    courseId: string;
    sectionKey: string;
  }>();
  const navigate = useNavigate();

  const [students, setStudents] = useState<StudentStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sectionKey) return;

    const [code, type] = sectionKey.split("|");
    if (!code || (type !== "lect" && type !== "lab")) {
      setError("Invalid stubcode.");
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchSessionRoster({ code, type: type as "lect" | "lab" }, null)
      .then(setStudents)
      .catch((err: unknown) =>
        setError(getErrorMessage(err, "Failed to load masterlist."))
      )
      .finally(() => setLoading(false));
  }, [sectionKey]);

  return (
    <div className="bg-cream min-h-screen p-6">
      <button
        onClick={() =>
          courseId ? navigate(`/courses/${courseId}`) : navigate("/courses")
        }
        className="text-orange mb-4 inline-flex items-center gap-1 text-sm font-medium hover:underline"
      >
        <CgArrowLeft /> Back
      </button>

      <div className="mx-auto max-w-3xl">
        <div className="border-tan rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-navy text-2xl font-bold">
            Masterlist — Stubcode {sectionKey?.replace("|", " · ")}
          </h1>
          <p className="text-navy/60 mt-1 text-sm">
            {students.length} enrolled student{students.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="border-tan mt-6 rounded-xl border bg-white shadow-sm">
          {error && (
            <p className="border-b border-tan bg-red-50 px-6 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {loading ? (
            <p className="text-navy/60 px-6 py-8 text-center text-sm">
              Loading...
            </p>
          ) : students.length === 0 ? (
            <p className="text-navy/40 px-6 py-8 text-center text-sm">
              No students enrolled in this stubcode yet.
            </p>
          ) : (
            <ul className="divide-y divide-tan">
              {students.map((student, i) => (
                <li
                  key={student.id}
                  className="flex items-center gap-4 px-6 py-3"
                >
                  <span className="text-navy/40 w-8 text-right font-mono text-sm">
                    {i + 1}
                  </span>
                  <span className="text-navy flex-1 text-sm font-medium">
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
