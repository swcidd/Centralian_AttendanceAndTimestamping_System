import { Course } from "../../types/types";
import CourseCard from "./CourseCard";



interface CourseGridProps {
  courses: Course[];
  onAddStub: (courseId: string) => void;
  onAssign: (courseId: string) => void;
  onDelete: (courseId: string) => void;
}

const CourseGrid = ({ courses, onAddStub, onAssign, onDelete }: CourseGridProps) => {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {courses.map((course) => (
        <CourseCard
          key={course.courseId}
          stubs={course.stubs}
          name={course.name}
          schedule={course.schedule}
          instructor={course.instructor}
          deviceMac={course.deviceMac}
          roomName={course.roomName}
          onAddStub={() => onAddStub(course.courseId)}
          onAssign={() => onAssign(course.courseId)}
          onDelete={() => onDelete(course.courseId)}
        />
      ))}
    </div>
  );
};

export default CourseGrid;