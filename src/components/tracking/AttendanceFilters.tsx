type AttendanceFiltersProps = {
  selectedCourse: string;
  selectedStub: string;
  onCourseChange: (value: string) => void;
  onStubChange: (value: string) => void;
  onScan: () => void;
};

const AttendanceFilters = ({
  selectedCourse,
  selectedStub,
  onCourseChange,
  onStubChange,
  onScan,
}: AttendanceFiltersProps) => {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex gap-4">
          <select
            value={selectedCourse}
            onChange={(e) => onCourseChange(e.target.value)}
            className="rounded border px-4 py-2"
          >
            <option value="" disabled>
              Course
            </option>
            <option>CS101</option>
            <option>IT201</option>
          </select>
          <select
            value={selectedStub}
            onChange={(e) => onStubChange(e.target.value)}
            className="rounded border px-4 py-2"
          >
            <option value="" disabled>
              Stub Code
            </option>
            <option>Stub 1</option>
            <option>Stub 2</option>
          </select>
      </div>

      <button
        onClick={onScan}
        className="rounded bg-green-600 px-5 py-2 text-white hover:bg-green-700"
      >
        Start Scanning
      </button>
    </div>
  );
};

export default AttendanceFilters;
