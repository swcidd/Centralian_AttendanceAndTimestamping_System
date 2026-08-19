import { useState } from "react";

import StudentTrackRow from "./StudentTrackRow";
import StudentTrackDetails from "./StudentTrackDetails";

import { StudentAttendance } from "../../types/types";



const students: StudentAttendance[] = [
  {
    id: "2026-001",
    name: "Student #1",
    attendance: "95%",
  },
  {
    id: "2026-002",
    name: "Student #2",
    attendance: "90%",
  },
  {
    id: "2026-003",
    name: "Student #3",
    attendance: "100%",
  },
  {
    id: "2026-004",
    name: "Student #4",
    attendance: "85%",
  },
  {
    id: "2026-005",
    name: "Student #5",
    attendance: "92%",
  },
];

const StudentTrackTable = () => {
  const [selectedStudent, setSelectedStudent] = useState<StudentAttendance | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-800">Student Track</h2>
          <p className="mt-1 text-sm text-gray-500">
            Student attendance summary
          </p>
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
              {students.map((student) => (
                <StudentTrackRow
                  key={student.id}
                  studentId={student.id}
                  studentName={student.name}
                  attendance={student.attendance}
                  onClick={() => setSelectedStudent(student)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedStudent && (
        <StudentTrackDetails
          name={selectedStudent.name}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </>
  );
};

export default StudentTrackTable;
