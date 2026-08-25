import { StudentStatus } from "../../types/types";

interface ActivityDetailsProps {
  date: string;
  students: StudentStatus[];
}

const ActivityDetails = ({ date, students }: ActivityDetailsProps) => {
  return (
    <div className="overflow-hiden border-tan rounded-xl border bg-white shadow-sm">
      <h2 className="text-navy p-5 text-xl font-bold">{date}</h2>

      <table className="w-full">
        <thead className="bg-navy">
          <tr className="text-left">
            <th className="px-4 py-3 text-sm font-semibold text-white">
              Student
            </th>

            <th className="px-4 py-3 text-sm font-semibold text-white">
              Status
            </th>
          </tr>
        </thead>

        <tbody>
          {students.map((student) => (
            <tr
              key={student.id}
              className="border-tan hover:bg-cream border-b transition-colors last:border-b-0"
            >
              <td className="text-navy px-4 py-3 font-medium">
                {student.name}
              </td>

              <td className="text-navy/70 px-4 py-3">{student.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ActivityDetails;
