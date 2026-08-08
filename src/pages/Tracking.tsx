import TrackingFilters from "../components/tracking/TrackingFilters";
import TrackingTable from "../components/tracking/TrackingTable";

const students = [
  { id: 1, name: "Student #1", status: "Present" as const },
  { id: 2, name: "Student #2", status: "Present" as const },
  { id: 3, name: "Student #3", status: "Present" as const },
  { id: 4, name: "Student #4", status: "Pending" as const },
  { id: 5, name: "Student #5", status: "Late" as const },
  { id: 6, name: "Student #6", status: "Present" as const },
  { id: 7, name: "Student #7", status: "Late" as const },
  { id: 8, name: "Student #8", status: "Absent" as const },
];

const Tracking = () => {
  return (
    <div className="space-y-6">
      <TrackingFilters />

      <TrackingTable students={students} />
    </div>
  );
};

export default Tracking;
