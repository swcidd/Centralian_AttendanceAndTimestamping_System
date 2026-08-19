import TrackingStatus from "./TrackingStatus";

interface TrackingRowProps {
  studentName: string;
  status: "Present" | "Late" | "Absent";
}

const TrackingRow = ({ studentName, status }: TrackingRowProps) => {
  return (
    <tr className="border-b">
      <td className="px-4 py-3">{studentName}</td>

      <td className="px-4 py-3">
        <TrackingStatus status={status} />
      </td>
    </tr>
  );
};

export default TrackingRow;
