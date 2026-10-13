import { supabase } from "../lib/supabase";
import type { Course } from "../types/types";

// PostgREST row shapes for the room-mode schema. The UI keeps its own
// display-oriented `Course` view model (see types.ts), so everything
// here is an adapter from the normalised tables into that model.
interface ScheduleRow {
  schedule_room: string;
  schedule_day: number;
  schedule_start: string;
  schedule_end: string;
}

interface CourseRow {
  course_id: string;
  course_code: string;
  course_name: string;
  course_type: "lect" | "lab";
  stubcodes: Array<{ course_stubcode: number }> | null;
  stubcode_schedules: ScheduleRow[] | null;
  instructors: { first_name: string; last_name: string } | null;
}

export interface DeviceInfo {
  deviceMac: string;
  roomName: string;
  status: string;
}

// schedule_day is ISO (1 = Monday ... 7 = Sunday).
const DAY_LABELS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatSchedule(rows: ScheduleRow[]): string {
  if (rows.length === 0) return "No schedule set";
  const days = [...new Set(rows.map((r) => r.schedule_day))]
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d] ?? "")
    .filter(Boolean)
    .join("/");
  const first = rows[0];
  const start = (first.schedule_start ?? "").slice(0, 5);
  const end = (first.schedule_end ?? "").slice(0, 5);
  const room = first.schedule_room ? ` · ${first.schedule_room}` : "";
  return `${days}, ${start} - ${end}${room}`;
}

// Turns the form's "MWF" / "TTh" shorthand into ISO weekday numbers.
function parseDays(daysOfWeek: string): number[] {
  const token = daysOfWeek.toUpperCase().replace(/[^A-Z]/g, "");
  const out = new Set<number>();
  let i = 0;
  while (i < token.length) {
    const two = token.slice(i, i + 2);
    if (two === "TH") {
      out.add(4);
      i += 2;
      continue;
    }
    if (two === "SA") {
      out.add(6);
      i += 2;
      continue;
    }
    if (two === "SU") {
      out.add(7);
      i += 2;
      continue;
    }
    const single: Record<string, number> = { M: 1, T: 2, W: 3, F: 5 };
    if (single[token[i]]) out.add(single[token[i]]);
    i += 1;
  }
  return [...out].sort((a, b) => a - b);
}

function parseStubcode(stubCode: string): number {
  const stub = stubCode.trim();
  const value = Number(stub);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Stub code "${stub}" must be a positive number.`);
  }
  return value;
}

export async function fetchCourses(): Promise<Course[]> {
  const [coursesResult, devicesResult] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "course_id, course_code, course_name, course_type, stubcodes(course_stubcode), stubcode_schedules(schedule_room, schedule_day, schedule_start, schedule_end), instructors(first_name, last_name)"
      )
      .returns<CourseRow[]>(),
    supabase.from("devices").select("device_id, room"),
  ]);

  if (coursesResult.error) throw coursesResult.error;

  // A course's terminal is whatever device is registered for the room
  // its schedule meets in (the schema links courses to devices by room,
  // not by an explicit FK).
  const roomToDevice = new Map<string, string>();
  for (const device of (devicesResult.data ?? []) as Array<{
    device_id: string;
    room: string | null;
  }>) {
    if (device.room) roomToDevice.set(device.room, device.device_id);
  }

  return (coursesResult.data ?? []).map((course) => {
    const schedules = course.stubcode_schedules ?? [];
    const room = schedules[0]?.schedule_room ?? null;
    return {
      courseId: course.course_id,
      stubs: (course.stubcodes ?? [])
        .map((stub) => String(stub.course_stubcode))
        .sort((a, b) => a.localeCompare(b)),
      name: course.course_name,
      schedule: formatSchedule(schedules),
      instructor: course.instructors
        ? `${course.instructors.first_name} ${course.instructors.last_name}`
        : "Unassigned",
      deviceMac: room ? roomToDevice.get(room) ?? null : null,
      roomName: room,
    };
  });
}

// Registered terminals (the `devices` registry). Used to offer known
// terminals in the assignment UI instead of typing a raw MAC from
// memory.
export async function fetchDevices(): Promise<DeviceInfo[]> {
  const { data, error } = await supabase
    .from("devices")
    .select("device_id, room, status")
    .returns<Array<{ device_id: string; room: string | null; status: string }>>();

  if (error) throw error;

  return (data ?? []).map((device) => ({
    deviceMac: device.device_id,
    roomName: device.room ?? "",
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
    .upsert({ device_id: deviceMac, room: roomName });

  if (error) throw error;
}

// Assign (or unassign, when deviceMac is null) a terminal to an
// existing course. Assigning keeps the `devices` registry in sync, then
// points the course's schedule slots at the room the terminal lives in.
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
    .from("stubcode_schedules")
    .update({ schedule_room: roomName ?? "TBD" })
    .eq("course_id", courseId);

  if (error) throw error;
}

const UNIQUE_VIOLATION = "23505";

// Adds another stubcode to an existing course (Course 1:N Stubcode).
// Stub codes are the registrar's globally unique section number, so a
// duplicate is reported as a human-readable error instead of a raw
// Postgres violation.
export async function addStubcode(
  courseId: string,
  stubCode: string
): Promise<void> {
  const stub = parseStubcode(stubCode);
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("stubcodes")
    .insert({
      course_stubcode: stub,
      course_id: courseId,
      instructor_id: userData.user?.id ?? null,
    });

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

  const stub = parseStubcode(input.stubCode);

  if (input.deviceMac && input.roomName) {
    await upsertDevice(input.deviceMac, input.roomName);
  }

  const { data: course, error } = await supabase
    .from("courses")
    .insert({
      course_code: input.subjectCode,
      course_name: input.courseName,
      course_type: "lect",
      created_by: userData.user?.id ?? null,
    })
    .select("course_id")
    .single();

  if (error) throw error;

  // The form's stub code becomes the course's first section, and its
  // "MWF, 08:00 - 09:00" becomes one schedule row per weekday. If any of
  // that fails, remove the course again rather than leave a half-built
  // course behind.
  try {
    const { error: stubError } = await supabase
      .from("stubcodes")
      .insert({
        course_stubcode: stub,
        course_id: course.course_id,
        instructor_id: userData.user?.id ?? null,
      });
    if (stubError) {
      if (stubError.code === UNIQUE_VIOLATION) {
        throw new Error(`Stub code "${stub}" is already in use.`);
      }
      throw stubError;
    }

    const days = parseDays(input.daysOfWeek);
    if (days.length > 0) {
      const { error: scheduleError } = await supabase
        .from("stubcode_schedules")
        .insert(
          days.map((day) => ({
            course_id: course.course_id,
            course_stubcode: stub,
            schedule_room: input.roomName || "TBD",
            schedule_day: day,
            schedule_start: input.startTime,
            schedule_end: input.endTime,
          }))
        );
      if (scheduleError) throw scheduleError;
    }
  } catch (buildError) {
    await supabase.from("courses").delete().eq("course_id", course.course_id);
    throw buildError;
  }
}

const FOREIGN_KEY_VIOLATION = "23503";

// How many attendance rows sit beneath these stubcodes. Shown in the
// deletion confirmation so the operator sees exactly what will be
// dropped before the delete runs.
export async function countAttendance(stubCodes: string[]): Promise<number> {
  if (stubCodes.length === 0) return 0;

  const { count, error } = await supabase
    .from("attendance")
    .select("attendance_id", { count: "exact", head: true })
    .in(
      "course_stubcode",
      stubCodes.map((stub) => Number(stub)).filter((n) => Number.isInteger(n))
    );

  if (error) throw error;
  return count ?? 0;
}

// Deletes one stubcode from a course. Everything keyed beneath it —
// roster, schedules, sessions, room modes, and attendance — goes with it
// via the FK cascades; the UI confirms the record count first and the
// course must keep at least one stubcode (enforced in the page).
export async function deleteStubcode(stubCode: string): Promise<void> {
  const { error } = await supabase
    .from("stubcodes")
    .delete()
    .eq("course_stubcode", Number(stubCode));

  if (error) throw error;
}

// Deletes a course; its stubcodes and everything beneath them cascade.
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
