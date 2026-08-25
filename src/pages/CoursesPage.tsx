import CourseToolbar from "../components/courses/CourseToolbar";
import CourseGrid from "../components/courses/CourseGrid";
import StudentTrackTable from "../components/courses/StudentTrackTable";

import { Course } from "../types/types";

const courses: Course[] = [];

const CoursesPage = () => {
  return (
    <div className="bg-cream min-h-screen p-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="min-w-0">
          <div className="border-tan overflow-hidden rounded-xl border bg-white shadow-sm">
            <CourseToolbar />
            <div className="p-5">
              <CourseGrid courses={courses} />
            </div>
          </div>
        </section>
        <section className="min-w-0">
          <StudentTrackTable />
        </section>
      </div>
    </div>
  );
};

export default CoursesPage;
