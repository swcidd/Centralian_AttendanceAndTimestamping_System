// room-action — the instructor-facing state machine endpoint.
//
// Unlike ingest-tap this is called from the dashboard, so it
// authenticates with the caller's Supabase JWT (verify_jwt stays on by
// default) and only ever acts on sections that instructor owns. All
// writes go through the service_role client, which is why the browser
// never needs write access to session / attendance / mode tables.
//
// Actions:
//   start_attendance  open the room's 'attend' mode: create (or reuse)
//                     today's class_session, pre-generate absent
//                     attendance rows, then open the mode
//   start_enrollment  open the room's 'enroll' mode (no session)
//   close_session     close the session and drop the room's mode

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function manilaDateISO(): string {
  return new Date(Date.now() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

function manilaISODay(): number {
  const day = new Date(Date.now() + MANILA_OFFSET_MS).getUTCDay();
  return day === 0 ? 7 : day; // 1 = Monday ... 7 = Sunday
}

interface RequestBody {
  action?: string;
  course_stubcode?: number | string;
  device_id?: string;
  room?: string;
  session_id?: string | null;
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Identify the caller from the request JWT.
  const authHeader = req.headers.get("Authorization") ?? "";
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await caller.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const admin: SupabaseClient = createClient(supabaseUrl, serviceKey);
  const courseStubcode = Number(body.course_stubcode);

  // The instructor owns a section directly, or is listed as a co-teacher.
  const owns = async (stubcode: number): Promise<boolean> => {
    if (!Number.isInteger(stubcode)) return false;
    const { data: stub } = await admin
      .from("stubcodes")
      .select("instructor_id")
      .eq("course_stubcode", stubcode)
      .maybeSingle();
    if (stub?.instructor_id === user.id) return true;
    const { data: co } = await admin
      .from("stubcode_instructors")
      .select("instructor_id")
      .eq("course_stubcode", stubcode)
      .eq("instructor_id", user.id)
      .maybeSingle();
    return Boolean(co);
  };

  // The room comes from the calling terminal's registration, never from
  // a client-supplied string other than as an explicit fallback.
  let room = body.room ?? null;
  if (!room && body.device_id) {
    const { data: device } = await admin
      .from("devices")
      .select("room")
      .eq("device_id", body.device_id)
      .maybeSingle();
    room = (device?.room as string | null) ?? null;
  }

  switch (body.action) {
    case "start_enrollment": {
      if (!(await owns(courseStubcode))) return json({ error: "forbidden" }, 403);
      if (!room) return json({ error: "terminal is not assigned to a room" }, 409);

      const { data: busy } = await admin
        .from("room_modes")
        .select("mode, course_stubcode")
        .eq("room", room)
        .maybeSingle();
      if (busy) return json({ error: "room busy" }, 409);

      const { data: sectionBusy } = await admin
        .from("room_modes")
        .select("room")
        .eq("course_stubcode", courseStubcode)
        .maybeSingle();
      if (sectionBusy) {
        return json({ error: "this section already has an open mode" }, 409);
      }

      const { error } = await admin.from("room_modes").insert({
        room,
        mode: "enroll",
        course_stubcode: courseStubcode,
        session_id: null,
      });
      if (error) return json({ error: error.message }, 409);

      return json({ ok: true, room, session_id: null });
    }

    case "start_attendance": {
      if (!(await owns(courseStubcode))) return json({ error: "forbidden" }, 403);
      if (!room) return json({ error: "terminal is not assigned to a room" }, 409);

      // Prefer today's slot; fall back to the section's earliest one so
      // an instructor can open a session a little early or late.
      let { data: slot } = await admin
        .from("stubcode_schedules")
        .select("stubcode_schedule_id")
        .eq("course_stubcode", courseStubcode)
        .eq("schedule_day", manilaISODay())
        .order("schedule_start")
        .limit(1)
        .maybeSingle();

      if (!slot) {
        const { data: fallback } = await admin
          .from("stubcode_schedules")
          .select("stubcode_schedule_id")
          .eq("course_stubcode", courseStubcode)
          .order("schedule_day")
          .order("schedule_start")
          .limit(1)
          .maybeSingle();
        slot = fallback;
      }
      if (!slot) {
        return json({ error: "this section has no schedule to attend" }, 409);
      }

      const sessionDate = manilaDateISO();

      const { data: existingSession } = await admin
        .from("class_sessions")
        .select("session_id, closed_at")
        .eq("stubcode_schedule_id", slot.stubcode_schedule_id)
        .eq("session_date", sessionDate)
        .maybeSingle();

      if (existingSession?.closed_at) {
        return json({ error: "today's session for this slot is already closed" }, 409);
      }

      let sessionId = (existingSession?.session_id as string | undefined) ?? null;

      if (!sessionId) {
        const { data: created, error: createError } = await admin
          .from("class_sessions")
          .insert({
            stubcode_schedule_id: slot.stubcode_schedule_id,
            course_stubcode: courseStubcode,
            session_date: sessionDate,
          })
          .select("session_id")
          .single();
        if (createError || !created) {
          return json({ error: createError?.message ?? "could not open session" }, 409);
        }
        sessionId = created.session_id as string;

        // Pre-generate one absent row per enrolled student; a tap
        // updates its row rather than inserting a new one.
        const { data: enrolled } = await admin
          .from("enrollments")
          .select("enrollment_id")
          .eq("course_stubcode", courseStubcode)
          .is("dropped_at", null);

        if (enrolled && enrolled.length > 0) {
          await admin.from("attendance").upsert(
            enrolled.map((row) => ({
              session_id: sessionId,
              enrollment_id: row.enrollment_id,
              course_stubcode: courseStubcode,
            })),
            { onConflict: "session_id,enrollment_id", ignoreDuplicates: true }
          );
        }
      }

      const { data: existingMode } = await admin
        .from("room_modes")
        .select("room, session_id")
        .eq("room", room)
        .maybeSingle();

      if (existingMode && existingMode.session_id !== sessionId) {
        return json({ error: "room busy" }, 409);
      }

      if (!existingMode) {
        const { error: modeError } = await admin.from("room_modes").insert({
          room,
          mode: "attend",
          course_stubcode: courseStubcode,
          session_id: sessionId,
        });
        if (modeError) return json({ error: modeError.message }, 409);
      }

      return json({ ok: true, room, session_id: sessionId });
    }

    case "close_session": {
      const sessionId = body.session_id ?? null;

      if (sessionId) {
        const { data: session } = await admin
          .from("class_sessions")
          .select("course_stubcode")
          .eq("session_id", sessionId)
          .maybeSingle();
        if (session && !(await owns(session.course_stubcode as number))) {
          return json({ error: "forbidden" }, 403);
        }

        await admin
          .from("class_sessions")
          .update({ closed_at: new Date().toISOString() })
          .eq("session_id", sessionId)
          .is("closed_at", null);
        await admin.from("room_modes").delete().eq("session_id", sessionId);
        return json({ ok: true });
      }

      // Registration mode has no session; close it by room.
      if (!room) return json({ error: "nothing to close" }, 409);
      const { data: mode } = await admin
        .from("room_modes")
        .select("course_stubcode")
        .eq("room", room)
        .maybeSingle();
      if (mode && !(await owns(mode.course_stubcode as number))) {
        return json({ error: "forbidden" }, 403);
      }
      await admin.from("room_modes").delete().eq("room", room);
      return json({ ok: true });
    }

    default:
      return json({ error: "unknown action" }, 400);
  }
});
