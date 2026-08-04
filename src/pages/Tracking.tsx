import { useState } from "react";

import AttendanceFilters from "../components/tracking/AttendanceFilters";
import AttendanceTable from "../components/tracking/AttendanceTable";

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
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedStub, setSelectedStub] = useState("");

  const handleScan = () => {
    console.log("Start scanning...");
  };

  return (
    <div className="space-y-6">
      <AttendanceFilters
        selectedCourse={selectedCourse}
        selectedStub={selectedStub}
        onCourseChange={setSelectedCourse}
        onStubChange={setSelectedStub}
        onScan={handleScan}
      />

      <AttendanceTable students={students} />
    </div>
  );
};

export default Tracking;
