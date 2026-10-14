import { useState } from "react";
import { addStubcode } from "../../services/coursesApi";
import { getErrorMessage } from "../../lib/errors";
import type { Course, CourseType } from "../../types/types";

interface AddStubcodeModalProps {
  course: Course;
  onClose: () => void;
  onAdded: () => void;
}

const inputClass =
  "border-tan text-navy focus:border-orange focus:ring-orange/20 w-full rounded-lg border bg-white px-4 py-2.5 text-sm outline-none focus:ring-2";

// Blank/invalid timing falls back to the schema defaults.
function toMinutes(value: FormDataEntryValue | null, fallback: number): number {
  const n = Number(typeof value === "string" ? value : "");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// Adds another independent section to an existing course. The section gets
// its own class type and its own schedule/terminal — it does NOT inherit
// the course's, unlike the previous shared-schedule behaviour.
const AddStubcodeModal = ({
  course,
  onClose,
  onAdded,
}: AddStubcodeModalProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const stubCode = (formData.get("stubCode") as string).trim();
    if (!stubCode) return;

    const deviceMac = (formData.get("deviceMac") as string)
      .trim()
      .toUpperCase();
    const roomName = (formData.get("roomName") as string).trim();
    if (deviceMac && !roomName) {
      setError("Room name is required when assigning a device.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addStubcode(course.courseId, stubCode, {
        courseType: formData.get("courseType") as CourseType,
        startTime: formData.get("startTime") as string,
        endTime: formData.get("endTime") as string,
        daysOfWeek: formData.get("daysOfWeek") as string,
        lateAfterMinutes: toMinutes(formData.get("lateAfterMinutes"), 15),
        absentAfterMinutes: toMinutes(formData.get("absentAfterMinutes"), 30),
        deviceMac: deviceMac || null,
        roomName: roomName || null,
      });
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
        className="animate-scale-in w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-navy mb-1 text-xl font-bold">Add Stubcode</h2>
        <p className="text-navy/60 mb-4 text-sm">
          New stubcode for <span className="font-medium">{course.name}</span>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              name="stubCode"
              required
              placeholder="Stub Code (e.g. CS101-B)"
              className={inputClass}
              autoFocus
            />
            <select
              name="courseType"
              defaultValue="lect"
              aria-label="Class type"
              className={inputClass}
            >
              <option value="lect">Lecture</option>
              <option value="lab">Laboratory</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="time"
              name="startTime"
              required
              className={inputClass}
            />
            <input type="time" name="endTime" required className={inputClass} />
          </div>

          <input
            type="text"
            name="daysOfWeek"
            required
            placeholder="Days (e.g. MWF)"
            className={inputClass}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="lateAfterMinutes"
                className="text-navy/60 mb-1 block text-xs font-medium"
              >
                Late after (min)
              </label>
              <input
                id="lateAfterMinutes"
                name="lateAfterMinutes"
                type="number"
                min={1}
                defaultValue={15}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="absentAfterMinutes"
                className="text-navy/60 mb-1 block text-xs font-medium"
              >
                Absent after (min)
              </label>
              <input
                id="absentAfterMinutes"
                name="absentAfterMinutes"
                type="number"
                min={1}
                defaultValue={30}
                className={inputClass}
              />
            </div>
          </div>

          <p className="text-navy/60 pt-2 text-xs font-medium">
            Terminal (optional — can be assigned later)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              name="deviceMac"
              placeholder="Device MAC"
              className={inputClass}
            />
            <input
              type="text"
              name="roomName"
              placeholder="Room Name"
              className={inputClass}
            />
          </div>

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
