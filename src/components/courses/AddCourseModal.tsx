import { useState } from "react";
import { createCourse } from "../../services/coursesApi";
import { getErrorMessage } from "../../lib/errors";
import type { CourseType } from "../../types/types";

interface AddCourseModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const inputClass =
  "border-tan text-navy focus:border-orange focus:ring-orange/20 w-full rounded-lg border bg-white px-4 py-2.5 text-sm outline-none focus:ring-2";

// Blank/invalid timing falls back to the schema defaults.
function toMinutes(value: FormDataEntryValue | null, fallback: number): number {
  const n = Number(typeof value === "string" ? value : "");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const AddCourseModal = ({ onClose, onCreated }: AddCourseModalProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const stubCode = (formData.get("stubCode") as string).trim();
    const deviceMac = (formData.get("deviceMac") as string).trim().toUpperCase();
    const roomName = (formData.get("roomName") as string).trim();

    if (deviceMac && !roomName) {
      setError("Room name is required when assigning a device.");
      return;
    }
    // The schedule fields only matter when a stub code is given.
    if (stubCode) {
      const startTime = formData.get("startTime") as string;
      const endTime = formData.get("endTime") as string;
      const daysOfWeek = formData.get("daysOfWeek") as string;
      if (!startTime || !endTime || !daysOfWeek) {
        setError(
          "Start time, end time, and days are required when a stub code is given."
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await createCourse({
        subjectCode: formData.get("subjectCode") as string,
        courseName: formData.get("courseName") as string,
        stubCode,
        courseType: formData.get("courseType") as CourseType,
        startTime: (formData.get("startTime") as string) || "",
        endTime: (formData.get("endTime") as string) || "",
        daysOfWeek: (formData.get("daysOfWeek") as string) || "",
        lateAfterMinutes: toMinutes(formData.get("lateAfterMinutes"), 15),
        absentAfterMinutes: toMinutes(formData.get("absentAfterMinutes"), 30),
        deviceMac: deviceMac || null,
        roomName: roomName || null,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add course."));
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
        <h2 className="text-navy mb-4 text-xl font-bold">Add Course</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              name="subjectCode"
              required
              placeholder="Subject Code (e.g. CS101)"
              className={inputClass}
            />
            <input
              type="text"
              name="courseName"
              required
              placeholder="Course Name"
              className={inputClass}
            />
          </div>

          <p className="text-navy/60 pt-2 text-xs font-medium">
            First stubcode (optional — leave blank and add later)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              name="stubCode"
              placeholder="Stub Code (e.g. CS101-A)"
              className={inputClass}
              autoFocus
            />
            <div>
              <label
                htmlFor="courseType"
                className="text-navy/60 mb-1 block text-xs font-medium"
              >
                Class Type
              </label>
              <select
                id="courseType"
                name="courseType"
                defaultValue="lect"
                className={inputClass}
              >
                <option value="lect">Lecture</option>
                <option value="lab">Laboratory</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input type="time" name="startTime" className={inputClass} />
            <input type="time" name="endTime" className={inputClass} />
          </div>

          <input
            type="text"
            name="daysOfWeek"
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
              {isSubmitting ? "Adding..." : "Add Course"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCourseModal;
