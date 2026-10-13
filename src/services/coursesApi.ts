import { supabase } from "../lib/supabase";
import type { Course, CourseType } from "../types/types";

// PostgREST row shapes for the room-mode schema. The UI keeps its own
// display-oriented `Course` view model (see types.ts), so everything
// here is an adapter from the normalised tables into that model.
interface ScheduleRow {
  schedule_room: string;
  schedule_day: number;
  schedule_start: string;
  schedule_end: string;
}

// A stubcode is now a self-contained section: its own lecture/lab type
// and its own schedule rows, independent of any sibling section.
interface StubcodeRow {
  course_stubcode: number;
  course_type: CourseType;
  stubcode_schedules: ScheduleRow[] | null;
}

interface CourseRow {
  course_id: string;
  course_code: string;
  course_name: string;
  stubcodes: StubcodeRow[] | null;
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
        "course_id, course_code, course_name, stubcodes(course_stubcode, course_type, stubcode_schedules(schedule_room, schedule_day, schedule_start, schedule_end)), instructors(first_name, last_name)"
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
    const stubs = course.stubcodes ?? [];
    // The card aggregates every section's slots into one display line.
    const schedules = stubs.flatMap((stub) => stub.stubcode_schedules ?? []);
    const room = schedules[0]?.schedule_room ?? null;
    return {
      courseId: course.course_id,
      stubs: stubs
        .map((stub) => String(stub.course_stubcode))
        .sort((a, b) => a.localeCompare(b)),
      stubTypes: Object.fromEntries(
        stubs.map((stub) => [String(stub.course_stubcode), stub.course_type])
      ),
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
  courseType: CourseType;
  startTime: string;
  endTime: string;
  daysOfWeek: string;
  deviceMac: string | null;
  roomName: string | null;
}

// The fields a single section carries. Used both for a course's first
// section (inside NewCourseInput) and for sections added later.
export interface SectionInput {
  courseType: CourseType;
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

// Assign (or unassign, when deviceMac is null) a terminal to a course's
// sections. Assigning keeps the `devices` registry in sync, then points
// each section's schedule slots at the room the terminal lives in.
export async function assignDevice(
  stubCodes: string[],
  deviceMac: string | null,
  roomName: string | null
): Promise<void> {
  if (deviceMac && !roomName) {
    throw new Error("Room name is required when assigning a terminal.");
  }

  if (deviceMac && roomName) {
    await upsertDevice(deviceMac, roomName);
  }

  const stubs = stubCodes
    .map((stub) => Number(stub))
    .filter((stub) => Number.isInteger(stub));
  if (stubs.length === 0) return;

  const { error } = await supabase
    .from("stubcode_schedules")
    .update({ schedule_room: roomName ?? "TBD" })
    .in("course_stubcode", stubs);

  if (error) throw error;
}

const UNIQUE_VIOLATION = "23505";

// Writes one schedule row per weekday the section meets. `course_stubcode`
// is the only link — there is deliberately no course_id, so a section's
// schedule never bleeds into its siblings.
async function insertSchedules(
  stub: number,
  room: string,
  daysOfWeek: string,
  startTime: string,
  endTime: string
) {
  const days = parseDays(daysOfWeek);
  if (days.length === 0) return;

  const { error } = await supabase
    .from("stubcode_schedules")
    .insert(
      days.map((day) => ({
        course_stubcode: stub,
        schedule_room: room || "TBD",
        schedule_day: day,
        schedule_start: startTime,
        schedule_end: endTime,
      }))
    );

  if (error) throw error;
}

// Adds another section to an existing course. The new stubcode is
// independent: it carries its own lecture/lab type and its own schedule
// slots rather than inheriting the course's. Stub codes are the
// registrar's globally unique section number, so a duplicate is reported
// as a human-readable error instead of a raw Postgres violation.
export async function addStubcode(
  courseId: string,
  stubCode: string,
  input: SectionInput
): Promise<void> {
  const stub = parseStubcode(stubCode);
  const { data: userData } = await supabase.auth.getUser();

  if (input.deviceMac && input.roomName) {
    await upsertDevice(input.deviceMac, input.roomName);
  }

  const { error } = await supabase
    .from("stubcodes")
    .insert({
      course_stubcode: stub,
      course_id: courseId,
      instructor_id: userData.user?.id ?? null,
      course_type: input.courseType,
    });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(`Stub code "${stub}" is already in use.`);
    }
    throw error;
  }

  try {
    await insertSchedules(
      stub,
      input.roomName ?? "",
      input.daysOfWeek,
      input.startTime,
      input.endTime
    );
  } catch (scheduleError) {
    // Don't leave a section with no schedule behind.
    await supabase.from("stubcodes").delete().eq("course_stubcode", stub);
    throw scheduleError;
  }
}

export async function createCourse(input: NewCourseInput) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const stub = parseStubcode(input.stubCode);

  if (input.deviceMac && input.roomName) {
    await upsertDevice(input.deviceMac, input.roomName);
  }

  // A course is now identity only (code + name). Reuse an existing
  // subject so a lecture and a lab can live as two independent sections
  // under one course code instead of two near-duplicate course rows.
  const { data: existing, error: findError } = await supabase
    .from("courses")
    .select("course_id")
    .eq("course_code", input.subjectCode)
    .maybeSingle();
  if (findError) throw findError;

  let courseId: string | null = existing?.course_id ?? null;
  let createdCourse = false;

  if (!courseId) {
    const { data: course, error } = await supabase
      .from("courses")
      .insert({
        course_code: input.subjectCode,
        course_name: input.courseName,
        created_by: userData.user?.id ?? null,
      })
      .select("course_id")
      .single();

    if (error) throw error;
    courseId = course.course_id;
    createdCourse = true;
  }

  // The form's stub code becomes the course's first section, with its own
  // type; its "MWF, 08:00 - 09:00" becomes one schedule row per weekday.
  // If any of that fails, remove a course we just created rather than
  // leave a half-built course behind.
  try {
    const { error: stubError } = await supabase
      .from("stubcodes")
      .insert({
        course_stubcode: stub,
        course_id: courseId,
        instructor_id: userData.user?.id ?? null,
        course_type: input.courseType,
      });
    if (stubError) {
      if (stubError.code === UNIQUE_VIOLATION) {
        throw new Error(`Stub code "${stub}" is already in use.`);
      }
      throw stubError;
    }

    await insertSchedules(
      stub,
      input.roomName ?? "",
      input.daysOfWeek,
      input.startTime,
      input.endTime
    );
  } catch (buildError) {
    if (createdCourse && courseId) {
      await supabase.from("courses").delete().eq("course_id", courseId);
    }
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
