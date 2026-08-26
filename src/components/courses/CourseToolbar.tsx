import { useState } from "react";
import AddCourseModal from "./AddCourseModal";

interface CourseToolbarProps {
  onCourseAdded: () => void;
}

const CourseToolbar = ({ onCourseAdded }: CourseToolbarProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="border-tan flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1">
        <input
          type="text"
          placeholder="Search courses..."
          className="border-tan text-navy focus:border-orange focus:ring-orange/20 w-full max-w-md rounded-lg border bg-white px-4 py-2.5 text-sm outline-none focus:ring-2"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-orange rounded-lg px-5 py-2.5 text-sm font-medium text-white hover:brightness-95 active:scale-90"
        >
          Add Course
        </button>
      </div>

      {isModalOpen && (
        <AddCourseModal
          onClose={() => setIsModalOpen(false)}
          onCreated={onCourseAdded}
        />
      )}
    </div>
  );
};

export default CourseToolbar;
