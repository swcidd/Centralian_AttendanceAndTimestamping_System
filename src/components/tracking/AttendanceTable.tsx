import AttendanceRow from "./AttendanceRow";

type Student = {
  id: number;
  name: string;
  status: "Present" | "Late" | "Absent" | "Pending";
};

type Props = {
  students: Student[];
};

const AttendanceTable = ({ students }: Props) => {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-3 text-left">Student Name</th>

            <th className="px-4 py-3 text-left">Status</th>
          </tr>
        </thead>

        <tbody>
          {students.map((student) => (
            <AttendanceRow
              key={student.id}
              studentName={student.name}
              status={student.status}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AttendanceTable;
