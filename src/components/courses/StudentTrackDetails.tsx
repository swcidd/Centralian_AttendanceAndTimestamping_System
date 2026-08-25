type StudentTrackDetailsProps = {
  name: string;
  onClose: () => void;
};

const StudentTrackDetails = ({ name, onClose }: StudentTrackDetailsProps) => {
  return (
    <div
      className="bg-navy/40 fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-orange p-5 text-center">
          <h2 className="text-2xl font-semibold text-white">{name}</h2>
        </div>

        <div className="bg-cream p-6">
          <div className="border-tan rounded-xl border bg-white p-5">
            <h3 className="text-navy mb-5 text-center text-xl font-semibold">
              Course Name
            </h3>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-navy w-16 font-medium">Week 1:</span>
                <span className="h-6 w-6 rounded bg-green-500" />
                <span className="h-6 w-6 rounded bg-green-500" />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-navy w-16 font-medium">Week 2:</span>
                <span className="h-6 w-6 rounded bg-green-500" />
                <span className="bg-orange h-6 w-6 rounded" />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-navy w-16 font-medium">Week 3:</span>
                <span className="h-6 w-6 rounded bg-red-500" />
                <span className="h-6 w-6 rounded bg-green-500" />
              </div>
            </div>
          </div>

          <select
            className="border-tan text-navy focus:border-orange focus:ring-orange/20 mt-5 w-full rounded-xl border bg-white p-3 text-center outline-none focus:ring-2"
            defaultValue="course"
          >
            <option value="course">Course Name</option>

            <option value="database">Database Systems</option>

            <option value="web">Web Development</option>
          </select>

          <button
            onClick={onClose}
            className="border-tan text-navy hover:bg-tan mt-4 w-full rounded-xl border bg-white px-4 py-3 font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentTrackDetails;
