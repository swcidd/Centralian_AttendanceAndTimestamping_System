import { supabase } from "../lib/supabase";
import type { Course, Course, Stubcode, StubcodeSchedule, Enrollment, AttendanceRecord, ClassSession, RoomMode, ScanResult, ScanLog } from "../types/types";

export interface CourseRow {
  course_id: string;
  course_code: string;
  course_name: string;
  course_type: "lect" | "lab";
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CourseWithStubcodes {
  course: CourseRow;
  stubcodes: Stubcode[];
  schedules: StubcodeSchedule[];
}

export async function fetchCourses(): Promise<CourseWithStubcodes[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(
      "course_id, course_code, course_name, course_type, created_by, created_at, updated_at, stubcodes (*), stubcode_schedules (*)"
    )
    .order("course_code");

  if (error) throw error;

  return (data ?? []).map((c) => ({
    course: {
      course_id: c.course_id,
      course_code: c.course_code,
      course_name: c.course_name,
      course_type: c.course_type,
      created_by: c.created_by,
      created_at: c.created_at,
      updated_at: c.updated_at,
    },
    stubcodes: c.stubcodes ?? [],
    schedules: c.stubcode_schedules ?? [],
  }));
}

export interface DeviceInfo {
  device_id: string;
  room: string;
  status: string;
}

export async function fetchDevices(): Promise<DeviceInfo[]> {
  const { data, error } = await supabase
    .from("devices")
    .select("device_mac, room, status")
    .order("device_mac");

  if (error) throw error;

  return (data ?? []).map((d) => ({
    device_id: d.device_mac,
    room: d.room,
    status: d.status,
  }));
}

export interface NewCourseInput {
  course_code: string;
  course_name: string;
  course_type: "lect" | "lab";
  stub_code: number;
}

export async function createCourse(input: NewCourseInput) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  // 1. Insert the course
  const { data: course, error } = await supabase
    .from("courses")
    .insert({
      course_code: input.course_code,
      course_name: input.course_name,
      course_type: input.course_type,
      created_by: userData.user?.id,
    })
    .select()
    .single();

  if (error) throw error;

  // 2. Insert the first stubcode under it
  const { error: stubError } = await supabase.from("stubcodes").insert({
    course_stubcode: input.stub_code,
    course_id: course.course_id,
    instructor_id: userData.user?.id,
  });

  if (stubError) {
    // Roll back the course creation
    await supabase.from("courses").delete().eq("course_id", course.course_id);
    throw stubError;
  }

  return course;
}

export async function addStubcode(courseId: string, stubCode: number): Promise<void> {
  const { error } = await supabase.from("stubcodes").insert({
    course_stubcode: stubCode,
    course_id: courseId,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error(`Stub code ${stubCode} is already in use.`);
    }
    throw error;
  }
}

export async function countAttendance(stubCodes: number[]): Promise<number> {
  if (stubCodes.length === 0) return 0;

  const { count, error } = await supabase
    .from("attendance")
    .select("attendance_id", { count: "exact", head: true })
    .in("course_stubcode", stubCodes);

  if (error) throw error;
  return count ?? 0;
}

export async function deleteStubcode(stubCode: number): Promise<void> {
  const { error } = await supabase.from("stubcodes").delete().eq("course_stubcode", stubCode);

  if (error) throw error;
}

export async function deleteCourse(courseId: string): Promise<void> {
  const { error } = await supabase.from("courses").delete().eq("course_id", courseId);

  if (error) throw error;
}

export async function fetchCourseSchedules(courseId: string) {
  const { data, error } = await supabase
    .from("stubcode_schedules")
    .select("*")
    .eq("course_id", courseId);

  if (error) throw error;
  return data ?? [];
}