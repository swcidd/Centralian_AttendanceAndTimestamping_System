import { StudentStatus } from "../../types/types";
import TrackingRow from "./TrackingRow";


interface TrackingTableProps {
  students: StudentStatus[];
}

const TrackingTable = ({ students }: TrackingTableProps) => {
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
            <TrackingRow
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

export default TrackingTable;
