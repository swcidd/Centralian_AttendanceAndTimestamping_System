import { Course } from "../../types/types";
import CourseCard from "./CourseCard";



interface CourseGridProps {
  courses: Course[];
  onAssign: (stub: string) => void;
  onDelete: (stub: string) => void;
}

const CourseGrid = ({ courses, onAssign, onDelete }: CourseGridProps) => {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {courses.map((course) => (
        <CourseCard
          key={course.stub}
          stub={course.stub}
          name={course.name}
          schedule={course.schedule}
          instructor={course.instructor}
          deviceMac={course.deviceMac}
          roomName={course.roomName}
          onAssign={() => onAssign(course.stub)}
          onDelete={() => onDelete(course.stub)}
        />
      ))}
    </div>
  );
};

export default CourseGrid;