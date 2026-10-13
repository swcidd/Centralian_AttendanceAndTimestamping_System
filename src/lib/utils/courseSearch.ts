import type { Course } from "../../types/types";

// Pure predicate factory: given a search term, returns a first-class
// function usable directly with Array.prototype.filter. Matches on
// course name, any of its stubcodes, or instructor, case-insensitively.
export function matchesCourseSearch(term: string): (course: Course) => boolean {
  const needle = term.trim().toLowerCase();
  if (needle === "") return () => true;

  return (course) =>
    course.name.toLowerCase().includes(needle) ||
    course.stubs.some((stub) => stub.toLowerCase().includes(needle)) ||
    course.instructor.toLowerCase().includes(needle);
}
