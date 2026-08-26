import { supabase } from "../lib/supabase";
import type { Course } from "../types/types";

interface CourseRow {
  stub_code: string;
  course_name: string;
  start_time: string;
  end_time: string;
  days_of_week: string;
  device_mac: string | null;
  profiles: { first_name: string; last_name: string } | null;
}

export async function fetchCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(
      "stub_code, course_name, start_time, end_time, days_of_week, device_mac, profiles(first_name, last_name)"
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
    deviceMac: course.device_mac,
  }));
}

export interface NewCourseInput {
  stubCode: string;
  subjectCode: string;
  courseName: string;
  startTime: string;
  endTime: string;
  daysOfWeek: string;
  deviceMac: string | null;
  roomName: string | null;
}

export async function upsertDevice(deviceMac: string, roomName: string) {
  const { error } = await supabase
    .from("devices")
    .upsert({ device_mac: deviceMac, room_name: roomName });

  if (error) throw error;
}

export async function createCourse(input: NewCourseInput) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  if (input.deviceMac && input.roomName) {
    await upsertDevice(input.deviceMac, input.roomName);
  }

  const { error } = await supabase.from("courses").insert({
    stub_code: input.stubCode,
    subject_code: input.subjectCode,
    course_name: input.courseName,
    instructor_id: userData.user?.id,
    device_mac: input.deviceMac,
    start_time: input.startTime,
    end_time: input.endTime,
    days_of_week: input.daysOfWeek,
  });

  if (error) throw error;
}

const FOREIGN_KEY_VIOLATION = "23503";

export async function deleteCourse(stubCode: string): Promise<void> {
  const { error } = await supabase.from("courses").delete().eq("stub_code", stubCode);

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      throw new Error(
        "This course has attendance records and can't be deleted."
      );
    }
    throw error;
  }
}
