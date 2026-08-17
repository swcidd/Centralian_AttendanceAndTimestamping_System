const CourseToolbar = () => {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="flex-1">
        <input
          type="text"
          placeholder="Search courses..."
          className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:border-gray-500"
        />
      </div>

      <div className="flex gap-3">
        <button className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Add Course
        </button>

        <button className="rounded-lg border border-red-500 px-5 py-2 text-sm font-medium text-red-500 hover:bg-red-50">
          Delete
        </button>
      </div>
    </div>
  );
};

export default CourseToolbar;
