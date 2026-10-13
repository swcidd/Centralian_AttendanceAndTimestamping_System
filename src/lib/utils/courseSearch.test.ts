import { describe, it, expect } from "vitest";
import { matchesCourseSearch } from "./courseSearch";
import type { Course } from "../../types/types";

const courses: Course[] = [
  {
    courseId: "course-1",
    stubs: ["CS101-A", "CS101-B"],
    name: "Intro to Computer Science",
    schedule: "MWF, 08:00 - 09:00",
    instructor: "Prof. Ada Lovelace",
    deviceMac: "B4:3A:45:A1:1D:0C",
    roomName: "Room 205",
  },
  {
    courseId: "course-2",
    stubs: ["SE101-B"],
    name: "Software Engineering 101",
    schedule: "TTh, 13:00 - 15:00",
    instructor: "Prof. Grace Hopper",
    deviceMac: null,
    roomName: null,
  },
];

describe("matchesCourseSearch", () => {
  it("matches every course for an empty term", () => {
    expect(courses.filter(matchesCourseSearch(""))).toEqual(courses);
  });

  it("matches every course for a whitespace-only term", () => {
    expect(courses.filter(matchesCourseSearch("   "))).toEqual(courses);
  });

  it("matches a course name case-insensitively", () => {
    expect(courses.filter(matchesCourseSearch("COMPUTER SCIENCE"))).toEqual([courses[0]]);
    expect(courses.filter(matchesCourseSearch("computer"))).toEqual([courses[0]]);
  });

  it("matches a stub code case-insensitively", () => {
    expect(courses.filter(matchesCourseSearch("se101"))).toEqual([courses[1]]);
    expect(courses.filter(matchesCourseSearch("CS101"))).toEqual([courses[0]]);
  });

  it("matches a course through any of its stubcodes", () => {
    // A course owns many stubcodes — searching a secondary one still
    // finds the course.
    expect(courses.filter(matchesCourseSearch("cs101-b"))).toEqual([courses[0]]);
  });

  it("matches an instructor name case-insensitively", () => {
    expect(courses.filter(matchesCourseSearch("grace"))).toEqual([courses[1]]);
    expect(courses.filter(matchesCourseSearch("ADA LOVELACE"))).toEqual([courses[0]]);
  });

  it("returns no matches for an unmatched term", () => {
    expect(courses.filter(matchesCourseSearch("biochemistry"))).toEqual([]);
  });

  it("trims surrounding whitespace from the search term", () => {
    expect(courses.filter(matchesCourseSearch("  software  "))).toEqual([courses[1]]);
  });

  it("produces a reusable predicate usable directly with filter", () => {
    const bySoftware = matchesCourseSearch("software");
    // Same predicate applied to different arrays (first-class functions).
    expect(courses.filter(bySoftware)).toEqual([courses[1]]);
    expect(courses.slice(1).filter(bySoftware)).toEqual([courses[1]]);
  });
});