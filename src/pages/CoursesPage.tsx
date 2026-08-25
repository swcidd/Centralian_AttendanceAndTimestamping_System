import CourseToolbar from "../components/courses/CourseToolbar";
import CourseGrid from "../components/courses/CourseGrid";
import StudentTrackTable from "../components/courses/StudentTrackTable";

import { Course } from "../types/types";

const courses: Course[] = [
  {
    stub: 201,
    name: "Software Engineering",
    schedule: "Monday, 8:00 AM - 10:00 AM",
    instructor: "Instructor 1",
  },

  {
    stub: 202,
    name: "Database Systems",
    schedule: "Tuesday, 10:00 AM - 12:00 PM",
    instructor: "Instructor 2",
  },

  {
    stub: 203,
    name: "Web Development",
    schedule: "Wednesday, 1:00 PM - 3:00 PM",
    instructor: "Instructor 3",
  },
  {
    stub: 204,
    name: "Software Design",
    schedule: "Thursday, 8:00 AM - 10:00 AM",
    instructor: "Instructor 4",
  },

  {
    stub: 205,
    name: "Data Structures",
    schedule: "Friday, 10:00 AM - 12:00 PM",
    instructor: "Instructor 5",
  },

  {
    stub: 206,
    name: "Human Computer Interaction",
    schedule: "Friday, 1:00 PM - 3:00 PM",
    instructor: "Instructor 6",
  },
];

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
