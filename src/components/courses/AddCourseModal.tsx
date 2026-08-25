import { useState } from "react";
import { createCourse } from "../../services/coursesApi";
import { getErrorMessage } from "../../lib/errors";

interface AddCourseModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const inputClass =
  "border-tan text-navy focus:border-orange focus:ring-orange/20 w-full rounded-lg border bg-white px-4 py-2.5 text-sm outline-none focus:ring-2";

const AddCourseModal = ({ onClose, onCreated }: AddCourseModalProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const deviceMac = (formData.get("deviceMac") as string).trim().toUpperCase();
    const roomName = (formData.get("roomName") as string).trim();

    if (deviceMac && !roomName) {
      setError("Room name is required when assigning a device.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createCourse({
        stubCode: formData.get("stubCode") as string,
        subjectCode: formData.get("subjectCode") as string,
        courseName: formData.get("courseName") as string,
        startTime: formData.get("startTime") as string,
        endTime: formData.get("endTime") as string,
        daysOfWeek: formData.get("daysOfWeek") as string,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg"
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
              name="stubCode"
              required
              placeholder="Stub Code (e.g. CS101-A)"
              className={inputClass}
            />
            <input
              type="text"
              name="subjectCode"
              required
              placeholder="Subject Code (e.g. CS101)"
              className={inputClass}
            />
          </div>

          <input
            type="text"
            name="courseName"
            required
            placeholder="Course Name"
            className={inputClass}
          />

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
