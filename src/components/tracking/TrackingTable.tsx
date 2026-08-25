import { StudentStatus } from "../../types/types";
import TrackingRow from "./TrackingRow";

interface TrackingTableProps {
  students: StudentStatus[];
}

const TrackingTable = ({ students }: TrackingTableProps) => {
  return (
    <div className="border-tan overflow-hidden rounded-lg bg-white shadow-sm">
      <table className="w-full">
        <thead className="bg-navy">
          <tr>
            <th className="font-semibold px-5 py-4 text-left text-sm text-white">
              Student Name
            </th>

            <th className="font-semibold px-5 py-4 text-left text-sm text-white">
              Status
            </th>
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
