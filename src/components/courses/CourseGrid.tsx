import type { Course } from "../../types/types";
import CourseCard from "./CourseCard";

interface CourseGridProps {
  courses: Course[];
  onOpenCourse: (courseId: string) => void;
  onDelete: (courseId: string) => void;
}

const CourseGrid = ({ courses, onOpenCourse, onDelete }: CourseGridProps) => {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {courses.map((course) => (
        <CourseCard
          key={course.courseId}
          sections={course.sections}
          name={course.name}
          schedule={course.schedule}
          instructor={course.instructor}
          deviceMac={course.deviceMac}
          roomName={course.roomName}
          onOpen={() => onOpenCourse(course.courseId)}
          onDelete={() => onDelete(course.courseId)}
        />
      ))}
    </div>
  );
};

export default CourseGrid;
