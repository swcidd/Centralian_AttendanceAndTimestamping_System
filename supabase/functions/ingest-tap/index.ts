// ingest-tap — the ESP32/PN532 scan endpoint.
//
// The device authenticates with a global PSK-HMAC (it has no Supabase
// session), so this function runs with verify_jwt = false. The room is
// derived server-side from the calling device's MAC: the browser can
// never tell the backend "this tap happened in room X".
//
// The tap is resolved against the room's current mode:
//   enroll  → the first tap of an encoded card creates Student + Card +
//             Enrollment (this is the registration flow)
//   attend  → the tap stamps the pre-generated absent attendance row
//             Present or Late
//
// Every request writes one scan_logs row, whatever the outcome.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { isClockSkewValid, verifyDeviceSignature } from "../_shared/deviceAuth.ts";

const PSK = Deno.env.get("DEVICE_PSK")!;

interface TapPayload {
  device_mac: string;
  nfc_uid: string;
  timestamp: number;
  signature: string;
  student_info?: {
    school_id: string;
    first_name: string;
    last_name: string;
  };
}

type ScanResult =
  | "ok"
  | "unknown_card"
  | "not_enrolled"
  | "no_active_mode"
  | "duplicate"
  | "rejected";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// The campus runs on Asia/Manila (UTC+8, no DST).
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

function manilaNow(): Date {
  return new Date(Date.now() + MANILA_OFFSET_MS);
}

function manilaMinutesOfDay(): number {
  const now = manilaNow();
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

function manilaDateISO(): string {
  return manilaNow().toISOString().slice(0, 10);
}

function manilaISODay(): number {
  const day = manilaNow().getUTCDay();
  return day === 0 ? 7 : day; // 1 = Monday ... 7 = Sunday
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

Deno.serve(async (req) => {
  let payload: TapPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (!isClockSkewValid(payload.timestamp)) {
    return json({ error: "clock skew too large" }, 401);
  }

  const message = `${payload.device_mac}${payload.timestamp}${payload.nfc_uid}`;
  const validSignature = await verifyDeviceSignature(PSK, message, payload.signature);
  if (!validSignature) {
    return json({ error: "invalid signature" }, 401);
  }

  // The card UID is compared against student_cards, so normalise it to
  // the same canonical form regardless of how the terminal formatted it.
  const nfcUid = (payload.nfc_uid ?? "")
    .replace(/[^0-9a-fA-F]/g, "")
    .toUpperCase();

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const logScan = async (fields: {
    result: ScanResult;
    room: string;
    mode?: "enroll" | "attend" | null;
    student_id?: string | null;
    course_stubcode?: number | null;
    session_id?: string | null;
  }) => {
    await admin.from("scan_logs").insert({
      room: fields.room,
      nfc_uid: nfcUid,
      mode: fields.mode ?? null,
      result: fields.result,
      student_id: fields.student_id ?? null,
      course_stubcode: fields.course_stubcode ?? null,
      session_id: fields.session_id ?? null,
    });
  };

  // 1. Which room is this terminal in?
  const { data: device } = await admin
    .from("devices")
    .select("room")
    .eq("device_id", payload.device_mac)
    .maybeSingle();

  if (!device?.room) {
    await logScan({ room: "unknown", result: "rejected" });
    return json({ error: "unregistered device" }, 403);
  }
  const room = device.room as string;

  // 2. Is the room in a mode at all?
  const { data: mode } = await admin
    .from("room_modes")
    .select("mode, course_stubcode, session_id")
    .eq("room", room)
    .maybeSingle();

  if (!mode) {
    await logScan({ room, result: "no_active_mode" });
    return json({ result: "no_active_mode" });
  }

  const courseStubcode = mode.course_stubcode as number;
  const modeType = mode.mode as "enroll" | "attend";

  // 3. Which student does this card belong to, if any?
  const { data: card } = await admin
    .from("student_cards")
    .select("student_id")
    .eq("nfc_uid", nfcUid)
    .is("revoked_at", null)
    .maybeSingle();

  let studentId: string | null = (card?.student_id as string | undefined) ?? null;

  // 4. enrollment mode
  if (modeType === "enroll") {
    let created = false;

    // A card written by the encoder carries the student's details, so
    // the very first tap creates the record; a card the system has never
    // seen and that carries no payload cannot be enrolled.
    if (!studentId && payload.student_info) {
      const info = payload.student_info;
      const { error: studentError } = await admin.from("students").upsert(
        {
          student_id: info.school_id,
          student_firstname: info.first_name,
          student_lastname: info.last_name,
        },
        { onConflict: "student_id" }
      );
      if (!studentError) {
        studentId = info.school_id;
        await admin.from("student_cards").insert({
          student_id: info.school_id,
          nfc_uid: nfcUid,
        });
        created = true;
      }
    }

    if (!studentId) {
      await logScan({ room, result: "unknown_card", mode: modeType });
      return json({ result: "unknown_card" });
    }

    const { data: existing } = await admin
      .from("enrollments")
      .select("enrollment_id, dropped_at")
      .eq("course_stubcode", courseStubcode)
      .eq("student_id", studentId)
      .maybeSingle();

    if (existing && existing.dropped_at === null) {
      await logScan({
        room,
        result: "duplicate",
        mode: modeType,
        student_id: studentId,
        course_stubcode: courseStubcode,
      });
      return json({ result: "duplicate" });
    }

    if (existing) {
      await admin
        .from("enrollments")
        .update({ dropped_at: null, enrolled_at: new Date().toISOString() })
        .eq("enrollment_id", existing.enrollment_id);
    } else {
      await admin.from("enrollments").insert({
        course_stubcode: courseStubcode,
        student_id: studentId,
      });
    }

    await logScan({
      room,
      result: "ok",
      mode: modeType,
      student_id: studentId,
      course_stubcode: courseStubcode,
    });
    return json({ result: "ok", enrolled: true, created });
  }

  // 5. attendance mode
  if (!studentId) {
    await logScan({ room, result: "unknown_card", mode: modeType });
    return json({ result: "unknown_card" });
  }

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("enrollment_id")
    .eq("course_stubcode", courseStubcode)
    .eq("student_id", studentId)
    .is("dropped_at", null)
    .maybeSingle();

  if (!enrollment) {
    await logScan({
      room,
      result: "not_enrolled",
      mode: modeType,
      student_id: studentId,
      course_stubcode: courseStubcode,
    });
    return json({ result: "not_enrolled" });
  }

  // Present vs Late comes from the session's schedule slot.
  const { data: session } = await admin
    .from("class_sessions")
    .select("session_id, stubcode_schedules(schedule_start, late_after_minutes)")
    .eq("session_id", mode.session_id)
    .maybeSingle();
  const schedule = (session?.stubcode_schedules ?? null) as
    | { schedule_start: string; late_after_minutes: number }
    | null;
  const delayMinutes = schedule
    ? manilaMinutesOfDay() - timeToMinutes(schedule.schedule_start)
    : 0;
  const attendanceStatus =
    schedule && delayMinutes > schedule.late_after_minutes ? "late" : "present";

  const { data: attendanceRow } = await admin
    .from("attendance")
    .select("attendance_id, status")
    .eq("session_id", mode.session_id)
    .eq("enrollment_id", enrollment.enrollment_id)
    .maybeSingle();

  if (
    attendanceRow &&
    (attendanceRow.status === "present" || attendanceRow.status === "late")
  ) {
    await logScan({
      room,
      result: "duplicate",
      mode: modeType,
      student_id: studentId,
      course_stubcode: courseStubcode,
      session_id: mode.session_id,
    });
    return json({ result: "duplicate", attendance_status: attendanceRow.status });
  }

  if (attendanceRow) {
    await admin
      .from("attendance")
      .update({
        status: attendanceStatus,
        attendance_timestamp: new Date().toISOString(),
        source: "system",
      })
      .eq("attendance_id", attendanceRow.attendance_id);
  } else {
    await admin.from("attendance").insert({
      session_id: mode.session_id,
      enrollment_id: enrollment.enrollment_id,
      course_stubcode: courseStubcode,
      status: attendanceStatus,
      attendance_timestamp: new Date().toISOString(),
      source: "system",
    });
  }

  await logScan({
    room,
    result: "ok",
    mode: modeType,
    student_id: studentId,
    course_stubcode: courseStubcode,
    session_id: mode.session_id,
  });

  return json({ result: "ok", attendance_status: attendanceStatus });
});
