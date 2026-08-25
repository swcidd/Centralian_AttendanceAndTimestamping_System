import { supabase } from "../lib/supabase";
import type { Course } from "../types/types";

interface CourseRow {
  stub_code: string;
  course_name: string;
  start_time: string;
  end_time: string;
  days_of_week: string;
  profiles: { first_name: string; last_name: string } | null;
}

export async function fetchCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(
      "stub_code, course_name, start_time, end_time, days_of_week, profiles(first_name, last_name)"
    )
    .returns<CourseRow[]>();

  if (error) throw error;

  return (data ?? []).map((course) => ({
    stub: course.stub_code,
    name: course.course_name,
    schedule: `${course.days_of_week}, ${course.start_time} - ${course.end_time}`,
    instructor: course.profiles
      ? `${course.profiles.first_name} ${course.profiles.last_name}`
      : "Unassigned",
  }));
}
