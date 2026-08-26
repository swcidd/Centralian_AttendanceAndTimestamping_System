import { Course } from "../../types/types";
import CourseCard from "./CourseCard";



interface CourseGridProps {
  courses: Course[];
  onDelete: (stub: string) => void;
}

const CourseGrid = ({ courses, onDelete }: CourseGridProps) => {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {courses.map((course) => (
        <CourseCard
          key={course.stub}
          stub={course.stub}
          name={course.name}
          schedule={course.schedule}
          instructor={course.instructor}
          onDelete={() => onDelete(course.stub)}
        />
      ))}
    </div>
  );
};

export default CourseGrid;
