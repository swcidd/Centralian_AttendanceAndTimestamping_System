import { useState } from "react";
import { addStubcode } from "../../services/coursesApi";
import { getErrorMessage } from "../../lib/errors";
import type { Course } from "../../types/types";

interface AddStubcodeModalProps {
  course: Course;
  onClose: () => void;
  onAdded: () => void;
}

const inputClass =
  "border-tan text-navy focus:border-orange focus:ring-orange/20 w-full rounded-lg border bg-white px-4 py-2.5 text-sm outline-none focus:ring-2";

// Adds another stubcode to an existing course — the Course 1:N
// Stubcode side of the model. Same shape as AddCourseModal.
const AddStubcodeModal = ({ course, onClose, onAdded }: AddStubcodeModalProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const stubCode = (new FormData(e.currentTarget).get("stubCode") as string).trim();
    if (!stubCode) return;

    setIsSubmitting(true);
    try {
      await addStubcode(course.courseId, stubCode);
      onAdded();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add stubcode."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-md rounded-2xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-navy mb-1 text-xl font-bold">Add Stubcode</h2>
        <p className="text-navy/60 mb-4 text-sm">
          New stubcode for <span className="font-medium">{course.name}</span> —
          it shares this course's schedule, terminal, and thresholds.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <input
            type="text"
            name="stubCode"
            required
            placeholder="Stub Code (e.g. CS101-B)"
            className={inputClass}
            autoFocus
          />

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border-tan text-navy rounded-lg border px-5 py-2.5 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-orange rounded-lg px-5 py-2.5 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
            >
              {isSubmitting ? "Adding..." : "Add Stubcode"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStubcodeModal;
