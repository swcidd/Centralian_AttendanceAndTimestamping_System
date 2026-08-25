import TrackingFilters from "../components/tracking/TrackingFilters";
import TrackingTable from "../components/tracking/TrackingTable";
import TrackingButton from "../components/tracking/TrackingButton";

import { StudentStatus } from "../types/types";

const students: StudentStatus[] = [];

const TrackingPage = () => {
  return (
    <div className="bg-cream min-h-screen space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <TrackingFilters />
        <TrackingButton />
      </div>

      <TrackingTable students={students} />
    </div>
  );
};

export default TrackingPage;
