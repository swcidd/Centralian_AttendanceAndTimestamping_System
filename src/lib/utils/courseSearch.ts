import type { Course } from "../../types/types";

// Pure predicate factory: given a search term, returns a first-class
// function usable directly with Array.prototype.filter. Matches on
// course name, stub code, or instructor, case-insensitively.
export function matchesCourseSearch(term: string): (course: Course) => boolean {
  const needle = term.trim().toLowerCase();
  if (needle === "") return () => true;

  return (course) =>
    course.name.toLowerCase().includes(needle) ||
    course.stub.toLowerCase().includes(needle) ||
    course.instructor.toLowerCase().includes(needle);
}
