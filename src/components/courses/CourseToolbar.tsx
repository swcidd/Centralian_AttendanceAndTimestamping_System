const CourseToolbar = () => {
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
        <button className="bg-orange rounded-lg px-5 py-2.5 text-sm font-medium text-white hover:brightness-95 active:scale-90">
          Add Course
        </button>

        <button className="rounded-lg border border-red-300 px-5 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50">
          Delete
        </button>
      </div>
    </div>
  );
};

export default CourseToolbar;
