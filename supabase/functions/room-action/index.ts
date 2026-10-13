import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const { action, stub_code, room, session_id, course_id } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Basic authorization: the instructor must own this stubcode
  const { data: stub, error: stubErr } = await supabase
    .from("stubcodes")
    .select("instructor_id")
    .eq("course_stubcode", stub_code)
    .single();

  if (stubErr || !stub || stub.instructor_id !== Deno.env.get("SUPABASE_INSTRUCTOR_ID")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 403 });
  }

  switch (action) {
    case "start_enrollment": {
      // Flow 2: OPEN ENROLLMENT
      // INSERT INTO room_modes (room, mode, course_stubcode, session_id)
      // VALUES (:room, 'enroll', :stubcode, NULL).
      // If a row for this room already exists, fail with "room busy".
      const { error: modeErr } = await supabase.from("room_modes").insert({
        room,
        mode: 'enroll',
        course_stubcode: stub_code,
        session_id: null,
      });
      if (modeErr && modeErr.code === '23505') {
        // PK violation — room already has a mode
        return new Response(JSON.stringify({ error: "room busy", active_mode: modeErr.detail }), {
          status: 409
        });
      }
      if (modeErr) throw modeErr;
      return new Response(JSON.stringify({ status: "ack" }), { status: 200 });
    }

    case "start_attendance": {
      // Flow 4: START ATTENDANCE (one transaction):
      // 1. INSERT class_sessions (stubcode_schedule_id, course_stubcode,
      //    session_date = today in Asia/Manila).
      //    On conflict: existing open (closed_at IS NULL) -> reuse it (resume).
      //              existing closed -> reject. Reopening is OUT OF SCOPE.
      // 2. Generate attendance rows from masterlist (all default 'absent',
      //    timestamp NULL):
      //    INSERT INTO attendance (session_id, enrollment_id, course_stubcode)
      //    SELECT :session_id, enrollment_id, course_stubcode
      //    FROM enrollments
      //    WHERE course_stubcode = :stubcode AND dropped_at IS NULL
      //    ON CONFLICT (session_id, enrollment_id) DO NOTHING;
      // 3. INSERT room_modes (room, 'attend', :stubcode, :session_id).

      const today = new Date();
      const todayIso = today.toISOString().split('T')[0];

      // Step 1: INSERT class_session
      const { error: sesErr } = await supabase.from("class_sessions").insert({
        stubcode_schedule_id: session_id,
        course_stubcode: stub_code,
        session_date: todayIso,
        closed_at: null,
      }).onConflict('class_sessions_slot_date_key').doNothing();

      if (sesErr) {
        // Existing session open (closed_at IS NULL) -> reuse it (resume)
        // Existing session closed -> reject
        return new Response(JSON.stringify({ error: "session already active or closed" }), { status: 409 });
      }

      // Step 2: Generate attendance rows from masterlist
      const { error: attErr } = await supabase.from("attendance").insert({
        select: `
          session_id, enrollment_id, course_stubcode
          FROM enrollments
          WHERE course_stubcode = ${stub_code} AND dropped_at IS NULL
        `,
        count: "exact",
      }).onConflict('attendance_session_enrollment_key').doNothing();

      if (attErr) throw attErr;

      // Step 3: INSERT room_modes (room, 'attend', :stubcode, :session_id)
      const { error: modeErr } = await supabase.from("room_modes").insert({
        room,
        mode: 'attend',
        course_stubcode: stub_code,
        session_id: session_id,
      });
      if (modeErr && modeErr.code === '23505') {
        // Room already has a mode; the session was already started
        return new Response(JSON.stringify({ status: "resumed" }), { status: 200 });
      }
      if (modeErr) throw modeErr;

      return new Response(JSON.stringify({ status: "ack" }), { status: 200 });
    }

    case "close_session": {
      // Flow 6: CLOSE SESSION (ONE transaction):
      // UPDATE class_sessions SET closed_at = now()
      //   WHERE session_id = :id AND closed_at IS NULL;
      // DELETE FROM room_modes WHERE session_id = :id;
      // Attendance rows stay.

      // 1. Close the session
      const { error: closeErr } = await supabase.from("class_sessions")
        .update({ closed_at: new Date() })
        .eq("session_id", session_id)
        .eq("closed_at", null);

      if (closeErr) {
        // Existing session already closed -> reject. Reopening is OUT OF SCOPE.
        return new Response(JSON.stringify({ error: "session already closed" }), { status: 409 });
      }

      // 2. Delete room_modes row for this session
      await supabase.from("room_modes").delete().eq("session_id", session_id);

      return new Response(JSON.stringify({ status: "ack" }), { status: 200 });
    }

    default:
      return new Response(JSON.stringify({ error: "unknown action" }), { status: 400 });
  }
});