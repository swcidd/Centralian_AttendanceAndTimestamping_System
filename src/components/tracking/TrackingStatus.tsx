interface TrackingStatusProps {
  status: "Present" | "Late" | "Absent";
}

const TrackingStatus = ({ status }: TrackingStatusProps) => {
  switch (status) {
    case "Present":
      return (
        <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
          Present
        </span>
      );

    case "Late":
      return (
        <span className="bg-orange/10 text-orange rounded-full px-3 py-1 text-sm font-medium">
          Late
        </span>
      );

    case "Absent":
      return (
        <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
          Absent
        </span>
      );

    default:
      return (
        <span className="bg-tan text-navy/60 px-3 py-1 text-sm font-medium">
          -----
        </span>
      );
  }
};

export default TrackingStatus;
