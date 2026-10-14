import { supabase } from "../lib/supabase";
import type { CourseSection } from "../types/types";

export type SessionMode = "ACTIVE_ATTENDANCE" | "REGISTRATION";

export interface ActiveSession {
  sessionId: string | null;
  stubCode: string;
  /** The room the mode is anchored to (room_modes.room). */
  deviceMac: string;
  status: SessionMode;
}

type DbRoomMode = "attend" | "enroll";

const DB_TO_MODE: Record<DbRoomMode, SessionMode> = {
  attend: "ACTIVE_ATTENDANCE",
  enroll: "REGISTRATION",
};

interface RoomActionResponse {
  session_id?: string | null;
  error?: string;
}

// Every state transition runs server-side in the room-action Edge
// Function: opening a session has to write a class_session, its
// pre-generated absent attendance rows, and the room_mode as one unit,
// and the device-facing side of that must not be spoofable from the
// browser. The function re-derives the caller from the request JWT.
async function invokeRoomAction(
  body: Record<string, unknown>
): Promise<RoomActionResponse> {
  const { data, error } = await supabase.functions.invoke<RoomActionResponse>(
    "room-action",
    { body }
  );
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data ?? {};
}

// The section's live room mode. `room_modes.room` is the primary key, so
// a section (and a room) can have at most one open mode; the dashboard
// only ever needs the single row for the selected section.
export async function getActiveSession(
  section: CourseSection
): Promise<ActiveSession | null> {
  const { data, error } = await supabase
    .from("room_modes")
    .select("room, mode, session_id")
    .eq("course_stubcode", Number(section.code))
    .eq("course_type", section.type)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    sessionId: (data.session_id as string | null) ?? null,
    stubCode: section.code,
    deviceMac: data.room as string,
    status: DB_TO_MODE[data.mode as DbRoomMode],
  };
}

export async function startSession(
  section: CourseSection,
  deviceMac: string,
  mode: SessionMode = "ACTIVE_ATTENDANCE"
): Promise<void> {
  await invokeRoomAction({
    action: mode === "REGISTRATION" ? "start_enrollment" : "start_attendance",
    course_stubcode: Number(section.code),
    course_type: section.type,
    device_id: deviceMac,
  });
}

export async function closeSession(
  sessionId: string | null,
  deviceMac: string
): Promise<void> {
  await invokeRoomAction({
    action: "close_session",
    session_id: sessionId,
    device_id: deviceMac,
  });
}
