type Student = {
  id: number;
  name: string;
  status: "Present" | "Late" | "Absent";
};

interface ActivityDetailsProps {
  date: string;
  students: Student[];
};

const ActivityDetails = ({ date, students }: ActivityDetailsProps) => {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-xl font-semibold">{date}</h2>

      <table className="w-full">
        <thead>
          <tr className="border-b text-left">
            <th className="px-3 py-3">Student</th>

            <th className="px-3 py-3">Status</th>
          </tr>
        </thead>

        <tbody>
          {students.map((student) => (
            <tr key={student.id} className="border-b">
              <td className="px-3 py-3">{student.name}</td>

              <td className="px-3 py-3">{student.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ActivityDetails;
