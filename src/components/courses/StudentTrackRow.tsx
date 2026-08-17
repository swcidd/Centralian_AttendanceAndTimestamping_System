interface StudentTrackRowProps {
  studentName: string;
  studentId: string;
  attendance: string;
};

const StudentTrackRow = ({
  studentName,
  studentId,
  attendance,
}: StudentTrackRowProps) => {
  return (
    <tr className="border-b border-gray-200">
      <td className="px-4 py-3 text-sm text-gray-800">{studentId}</td>

      <td className="px-4 py-3 text-sm text-gray-800">{studentName}</td>

      <td className="px-4 py-3 text-sm text-gray-600">{attendance}</td>
    </tr>
  );
};

export default StudentTrackRow;
