import StudentTrackRow from "./StudentTrackRow";

const StudentTrackTable = () => {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-gray-800">Student Track</h2>

        <p className="mt-1 text-sm text-gray-500">Student attendance summary</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                Student ID
              </th>

              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                Student Name
              </th>

              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                Attendance
              </th>
            </tr>
          </thead>

          <tbody>
            <StudentTrackRow
              studentId="2026-001"
              studentName="Student #1"
              attendance="95%"
            />

            <StudentTrackRow
              studentId="2026-002"
              studentName="Student #2"
              attendance="90%"
            />

            <StudentTrackRow
              studentId="2026-003"
              studentName="Student #3"
              attendance="100%"
            />

            <StudentTrackRow
              studentId="2026-004"
              studentName="Student #4"
              attendance="85%"
            />

            <StudentTrackRow
              studentId="2026-005"
              studentName="Student #5"
              attendance="92%"
            />
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentTrackTable;
