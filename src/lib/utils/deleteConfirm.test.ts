import { describe, it, expect } from "vitest";
import { courseDeleteConfirm, stubDeleteConfirm } from "./deleteConfirm";

describe("courseDeleteConfirm", () => {
  it("stays plain when the course has no attendance", () => {
    const message = courseDeleteConfirm("Intro to CS", 0);
    expect(message).toContain('Delete course "Intro to CS"?');
    expect(message).not.toContain("attendance");
  });

  it("spells out a single attendance record being dropped first", () => {
    const message = courseDeleteConfirm("Intro to CS", 1);
    expect(message).toContain("drop its 1 attendance record first");
    expect(message).not.toContain("1 attendance records");
    expect(message).toContain("can't be undone");
  });

  it("pluralizes the record count", () => {
    expect(courseDeleteConfirm("Intro to CS", 143)).toContain(
      "drop its 143 attendance records first"
    );
  });
});

describe("stubDeleteConfirm", () => {
  it("stays plain when the stubcode has no attendance", () => {
    const message = stubDeleteConfirm("CS101-B", 0);
    expect(message).toContain('Delete stubcode "CS101-B"?');
    expect(message).not.toContain("attendance");
  });

  it("spells out the history that goes with the stubcode", () => {
    const message = stubDeleteConfirm("CS101-B", 7);
    expect(message).toContain('Delete stubcode "CS101-B" and drop its 7 attendance records first');
    expect(message).toContain("can't be undone");
  });
});
