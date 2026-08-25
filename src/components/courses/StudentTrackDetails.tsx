type StudentTrackDetailsProps = {
  name: string;
  onClose: () => void;
};

const StudentTrackDetails = ({ name, onClose }: StudentTrackDetailsProps) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-orange overflow-hidden rounded-t-2xl p-4 text-center">
          <h2 className="text-2xl font-semibold">{name}</h2>
        </div>

        <div className="bg-tan rounded-b-2xl p-8">
          <div className="rounded-xl border bg-white p-5">
            <h3 className="mb-5 text-center text-xl">Course Name</h3>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span>Week 1:</span>
                <span className="h-6 w-6 border bg-green-500" />
                <span className="h-6 w-6 border bg-green-500" />
              </div>

              <div className="flex items-center gap-3">
                <span>Week 2:</span>
                <span className="h-6 w-6 border bg-green-500" />
                <span className="h-6 w-6 border bg-yellow-500" />
              </div>

              <div className="flex items-center gap-3">
                <span>Week 3:</span>
                <span className="h-6 w-6 border bg-red-500" />
                <span className="h-6 w-6 border bg-green-500" />
              </div>
            </div>
          </div>

          <select
            className="mt-6 w-full appearance-none rounded-xl border bg-white p-3 text-center"
            defaultValue="course"
          >
            <option value="course">Course Name</option>

            <option value="database">Database Systems</option>

            <option value="web">Web Development</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default StudentTrackDetails;
