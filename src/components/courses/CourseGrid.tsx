import { Course } from "../../types/types";
import CourseCard from "./CourseCard";



interface CourseGridProps {
  courses: Course[];
}

const CourseGrid = ({ courses }: CourseGridProps) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      {courses.map((course) => (
        <CourseCard
        stub={course.stub}
        name={course.name}
        schedule={course.schedule}
        instructor={course.instructor}
      />
      ))}
      
    </div>
  );
};

export default CourseGrid;
