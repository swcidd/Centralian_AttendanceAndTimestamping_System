import AttendanceStatus from "./AttendanceStatus";

type AttendanceRowProps = {
  studentName: string;
  status: "Present" | "Late" | "Absent" | "Pending";
};

const AttendanceRow = ({ studentName, status }: AttendanceRowProps) => {
  return (
    <tr className="border-b">

      <td className="px-4 py-3">
        {studentName}
      </td>

      <td className="px-4 py-3">
        <AttendanceStatus status={status} />
      </td>

    </tr>
  );
};

export default AttendanceRow;