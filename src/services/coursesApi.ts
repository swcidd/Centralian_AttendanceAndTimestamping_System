import { supabase } from "../lib/supabase";
import type { Course } from "../types/types";

interface CourseRow {
  course_id: string;
  course_name: string;
  start_time: string;
  end_time: string;
  days_of_week: string;
  device_mac: string | null;
  stubcodes: Array<{ stub_code: string }> | null;
  devices: { room_name: string } | null;
  profiles: { first_name: string; last_name: string } | null;
}

export interface DeviceInfo {
  deviceMac: string;
  roomName: string;
  status: string;
}

export async function fetchCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(
      "course_id, course_name, start_time, end_time, days_of_week, device_mac, stubcodes(stub_code), devices(room_name), profiles(first_name, last_name)"
    )
    .returns<CourseRow[]>();

  if (error) throw error;

  return (data ?? []).map((course) => ({
    courseId: course.course_id,
    stubs: (course.stubcodes ?? [])
      .map((stub) => stub.stub_code)
      .sort((a, b) => a.localeCompare(b)),
    name: course.course_name,
    schedule: `${course.days_of_week}, ${course.start_time} - ${course.end_time}`,
    instructor: course.profiles
      ? `${course.profiles.first_name} ${course.profiles.last_name}`
      : "Unassigned",
    deviceMac: course.device_mac,
    roomName: course.devices?.room_name ?? null,
  }));
}

// Registered terminals (the `devices` registry). Used to offer known
// terminals in the assignment UI instead of typing a raw MAC from
// memory.
export async function fetchDevices(): Promise<DeviceInfo[]> {
  const { data, error } = await supabase
    .from("devices")
    .select("device_mac, room_name, status")
    .returns<Array<{ device_mac: string; room_name: string; status: string }>>();

  if (error) throw error;

  return (data ?? []).map((device) => ({
    deviceMac: device.device_mac,
    roomName: device.room_name,
    status: device.status,
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

// Assign (or unassign, when deviceMac is null) a terminal to an
// existing course. Assigning keeps the `devices` registry in sync —
// same upsert createCourse uses — then points the course at it.
export async function assignDevice(
  courseId: string,
  deviceMac: string | null,
  roomName: string | null
): Promise<void> {
  if (deviceMac && !roomName) {
    throw new Error("Room name is required when assigning a terminal.");
  }

  if (deviceMac && roomName) {
    await upsertDevice(deviceMac, roomName);
  }

  const { error } = await supabase
    .from("courses")
    .update({ device_mac: deviceMac })
    .eq("course_id", courseId);

  if (error) throw error;
}

const UNIQUE_VIOLATION = "23505";

// Adds another stubcode to an existing course (Course 1:N Stubcode).
// Stub codes are globally unique — they're the join key used by
// enrollments, sessions, and attendance — so a duplicate is reported
// as a human-readable error instead of a raw Postgres violation.
export async function addStubcode(
  courseId: string,
  stubCode: string
): Promise<void> {
  const stub = stubCode.trim();
  const { error } = await supabase
    .from("stubcodes")
    .insert({ stub_code: stub, course_id: courseId });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(`Stub code "${stub}" is already in use.`);
    }
    throw error;
  }
}

export async function createCourse(input: NewCourseInput) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  if (input.deviceMac && input.roomName) {
    await upsertDevice(input.deviceMac, input.roomName);
  }

  const { data: course, error } = await supabase
    .from("courses")
    .insert({
      subject_code: input.subjectCode,
      course_name: input.courseName,
      instructor_id: userData.user?.id,
      device_mac: input.deviceMac,
      start_time: input.startTime,
      end_time: input.endTime,
      days_of_week: input.daysOfWeek,
    })
    .select("course_id")
    .single();

  if (error) throw error;

  // The form's stub code becomes the course's first stubcode. If that
  // fails, remove the course again rather than leaving a course with
  // no stubcodes behind.
  try {
    await addStubcode(course.course_id, input.stubCode);
  } catch (stubError) {
    await supabase.from("courses").delete().eq("course_id", course.course_id);
    throw stubError;
  }
}

const FOREIGN_KEY_VIOLATION = "23503";

// How many attendance rows sit beneath these stubcodes. Shown in the
// deletion confirmation so the operator sees exactly what will be
// dropped before the delete runs (RLS lets any instructor read logs;
// deletion itself happens through FK cascades, not a client DELETE).
export async function countAttendance(stubCodes: string[]): Promise<number> {
  if (stubCodes.length === 0) return 0;

  const { count, error } = await supabase
    .from("attendance_logs")
    .select("log_id", { count: "exact", head: true })
    .in("stub_code", stubCodes);

  if (error) throw error;
  return count ?? 0;
}

// Deletes one stubcode from a course. Everything keyed beneath it —
// roster, sessions, device commands, pending registrations, and
// attendance — goes with it via the FK cascades set up by migrations
// 0012/0013; the UI confirms the record count first and the course
// must keep at least one stubcode (enforced in the page).
export async function deleteStubcode(stubCode: string): Promise<void> {
  const { error } = await supabase
    .from("stubcodes")
    .delete()
    .eq("stub_code", stubCode);

  if (error) throw error;
}

// Deletes a course; its stubcodes and everything beneath them cascade
// (migration 0013 dropped the history-blocking FK). The 23503 branch
// is a safety net — after 0013 nothing is expected to block.
export async function deleteCourse(courseId: string): Promise<void> {
  const { error } = await supabase
    .from("courses")
    .delete()
    .eq("course_id", courseId);

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      throw new Error(
        "This course can't be deleted while records still reference it."
      );
    }
    throw error;
  }
}
