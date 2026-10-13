import type { CourseSection, CourseType } from "../../types/types";

// A section's identity is (code, type). The UI needs a single string to
// use as a React key and as a <select> value, so it is joined here and
// parsed back where the (code, type) pair is needed.
export function sectionKey(section: CourseSection): string {
  return `${section.code}|${section.type}`;
}

export function parseSectionKey(key: string): CourseSection | null {
  const [code, type] = key.split("|");
  if (!code || (type !== "lect" && type !== "lab")) return null;
  return { code, type: type as CourseType };
}

const TYPE_LABEL: Record<CourseType, string> = {
  lect: "LEC",
  lab: "LAB",
};

export function sectionLabel(section: CourseSection): string {
  return `${section.code} (${TYPE_LABEL[section.type]})`;
}
