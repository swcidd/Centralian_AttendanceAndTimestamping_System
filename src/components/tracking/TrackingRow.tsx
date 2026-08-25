import TrackingStatus from "./TrackingStatus";

interface TrackingRowProps {
  studentName: string;
  status: "Present" | "Late" | "Absent";
}

const TrackingRow = ({ studentName, status }: TrackingRowProps) => {
  return (
    <tr className="border-tan hover:bg-cream border-b transition-colors">
      <td className="text-navy px-5 py-4 font-medium">{studentName}</td>

      <td className="px-5 py-4">
        <TrackingStatus status={status} />
      </td>
    </tr>
  );
};

export default TrackingRow;
