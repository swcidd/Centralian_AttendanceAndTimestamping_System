import { useState } from "react";

import StudentTrackRow from "./StudentTrackRow";
import StudentTrackDetails from "./StudentTrackDetails";

import { StudentAttendance } from "../../types/types";

const students: StudentAttendance[] = [];

const StudentTrackTable = () => {
  const [selectedStudent, setSelectedStudent] =
    useState<StudentAttendance | null>(null);

  return (
    <>
      <div className="border-tan overflow-hidden rounded-xl border bg-white shadow-sm">
        <h2 className="text-navy px-5 py-4 text-xl font-bold">
          Student Attendance Summary
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-navy">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-white">
                  Student ID
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white">
                  Student Name
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-white">
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
                  present={student.present}
                  late={student.late}
                  absent={student.absent}
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
