interface TrackingStatusProps {
  status: "Present" | "Late" | "Absent";
}

const TrackingStatus = ({ status }: TrackingStatusProps) => {
  switch (status) {
    case "Present":
      return <span className="text-green-600">Present ✓</span>;

    case "Late":
      return <span className="text-yellow-500">Late !</span>;

    case "Absent":
      return <span className="text-red-600">Absent ✕</span>;

    default:
      return <span className="text-gray-500">-----</span>;
  }
};

export default TrackingStatus;
