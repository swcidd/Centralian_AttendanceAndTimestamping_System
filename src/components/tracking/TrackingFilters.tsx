import { useEffect, useState } from "react";

import { fetchCourses } from "../../services/coursesApi";
import {
  parseSectionKey,
  sectionKey,
  sectionLabel,
} from "../../lib/utils/section";
import type { Course, CourseSection } from "../../types/types";

interface TrackingFiltersProps {
  // Emits the pair together so parent state can never drift out of
  // sync: picking a course also resolves its first section.
  onFilterChange: (course: Course | null, section: CourseSection | null) => void;
}

// Cascading Course -> Section filter. A course owns many sections
// (Course 1:N Section); the section dropdown only ever lists the
// selected course's sections and auto-selects the first of them. A
// number may repeat when the types differ, so options are labelled with
// the type and valued by (code, type).
const TrackingFilters = ({ onFilterChange }: TrackingFiltersProps) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  useEffect(() => {
    fetchCourses()
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);

  const selectedCourse =
    courses.find((course) => course.courseId === selectedCourseId) ?? null;

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const course =
      courses.find((c) => c.courseId === e.target.value) ?? null;
    const section = course?.sections[0] ?? null;
    setSelectedCourseId(e.target.value);
    setSelectedSection(section ? sectionKey(section) : "");
    onFilterChange(course, section);
  };

  const handleSectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSection(e.target.value);
    onFilterChange(selectedCourse, parseSectionKey(e.target.value));
  };

  const selectClass =
    "border-tan text-navy focus:border-orange focus:ring-orange/20 rounded-lg border bg-white px-4 py-2.5 outline-none focus:ring-2";

  return (
    <div className="flex gap-4">
      <select
        value={selectedCourseId}
        onChange={handleCourseChange}
        className={selectClass}
      >
        <option value="" disabled>
          Course
        </option>
        {courses.map((course) => (
          <option key={course.courseId} value={course.courseId}>
            {course.name}
          </option>
        ))}
      </select>
      <select
        value={selectedSection}
        onChange={handleSectionChange}
        disabled={!selectedCourse}
        className={selectClass}
      >
        <option value="" disabled>
          Stub Code
        </option>
        {(selectedCourse?.sections ?? []).map((section) => (
          <option key={sectionKey(section)} value={sectionKey(section)}>
            {sectionLabel(section)}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TrackingFilters;
