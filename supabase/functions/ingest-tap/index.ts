import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isClockSkewValid, verifyDeviceSignature } from "../_shared/deviceAuth.ts";

const PSK = Deno.env.get("DEVICE_PSK")!;
const UNIQUE_VIOLATION = "23505";

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

Deno.serve(async (req) => {
  const payload: TapPayload = await req.json();

  if (!isClockSkewValid(payload.timestamp)) {
    return new Response(JSON.stringify({ error: "clock skew too large" }), {
      status: 401,
    });
  }

  const message = `${payload.device_mac}${payload.timestamp}${payload.nfc_uid}`;
  const validSignature = await verifyDeviceSignature(PSK, message, payload.signature);
  if (!validSignature) {
    return new Response(JSON.stringify({ error: "invalid signature" }), {
      status: 401,
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Look up the session for this device
  const { data: session, error: sessionError } = await supabase
    .from("active_sessions")
    .select("session_id, stub_code, started_at, status")
    .eq("device_mac", payload.device_mac)
    .single();

  if (sessionError) {
    return new Response(JSON.stringify({ error: sessionError.message }), {
      status: 500,
    });
  }
  if (!session) {
    return new Response(
      JSON.stringify({ error: "no active session for this device" }),
      { status: 409 }
    );
  }

  // 2. Derive the room from the device (MAC → devices table → room)
  const { data: deviceRow, error: deviceErr } = await supabase
    .from("devices")
    .select("room")
    .eq("device_id", payload.device_mac)
    .single();

  if (deviceErr || !deviceRow) {
    // Device not registered; treat as no active mode
    await supabase.from("scan_logs").insert({
      scanned_at: new Date(payload.timestamp * 1000).toISOString(),
      room: payload.device_mac,
      nfc_uid: payload.nfc_uid,
      mode: null,
      result: 'no_active_mode',
      student_id: null,
      course_stubcode: session.stub_code,
      session_id: session.session_id,
    });
    return 'no_active_mode';
  }
  const deviceRoom = deviceRow.room;

  // 3. Look up the current room mode
  const { data: modeRow, error: modeErr } = await supabase
    .from("room_modes")
    .select("mode, session_id, course_stubcode")
    .eq("room", deviceRoom)
    .single();

  // 4. Execute the appropriate flow
  let result: string;

  if (session.status === "REGISTRATION") {
    // Flow 2: open enrollment is handled via the dedicated registration
    // path; for a tap during registration, just acknowledge.
    result = 'ok';
  } else if (modeRow?.mode === 'enroll') {
    // --- Flow 3: SCAN WHILE room mode = 'enroll' ---
    // 1. Resolve the student from the card
    const { data: studentCard, error: studentErr } = await supabase
      .from("student_cards")
      .select("student_id, revoked_at")
      .eq("nfc_uid", payload.nfc_uid)
      .single();

    if (studentErr || !studentCard || studentCard.revoked_at !== null) {
      // Write scan_logs row for unknown/unrevoked card
      await supabase.from("scan_logs").insert({
        scanned_at: new Date(payload.timestamp * 1000).toISOString(),
        room: deviceRoom,
        nfc_uid: payload.nfc_uid,
        mode: null,
        result: 'unknown_card',
        student_id: null,
        course_stubcode: session.stub_code,
        session_id: session.session_id,
      });
      return 'unknown_card';
    }

    const studentId = studentCard.student_id;

    // 2. Look for an enrollment with the same (course_stubcode, student_id)
    const { data: existingEnrollment, error: enrollErr } = await supabase
      .from("enrollments")
      .select("*")
      .eq("course_stubcode", session.stub_code)
      .eq("student_id", studentId)
      .single();

    if (enrollErr && enrollErr.code !== UNIQUE_VIOLATION) {
      // Insert new enrollment
      const { error: insertErr } = await supabase.from("enrollments").insert({
        course_stubcode: session.stub_code,
        student_id: studentId,
      });
      if (insertErr) throw insertErr;
      // Backfill open sessions for this stubcode
      const { data: newEnrollment } = await supabase
        .from("enrollments")
        .select("enrollment_id")
        .eq("course_stubcode", session.stub_code)
        .eq("student_id", studentId)
        .single();
      await supabase.from("attendance").insert({
        session_id: session.session_id,
        enrollment_id: newEnrollment.enrollment_id,
        course_stubcode: session.stub_code,
      });
      return 'ok';
    }

    // Existing enrollment found
    if (existingEnrollment.dropped_at !== null) {
      // Re-activate: clear dropped_at
      await supabase.from("enrollments")
        .update({ dropped_at: null })
        .eq("enrollment_id", existingEnrollment.enrollment_id);
      // Backfill open sessions
      await supabase.from("attendance").insert({
        session_id: session.session_id,
        enrollment_id: existingEnrollment.enrollment_id,
        course_stubcode: session.stub_code,
      });
      return 'ok';
    }

    // Existing active enrollment — duplicate tap
    return 'duplicate';
  } else if (modeRow?.mode === 'attend') {
    // --- Flow 5: SCAN WHILE room mode = 'attend' ---
    // 1. room_modes by room -> session_id and course_stubcode (already done)
    const attendSessionId = modeRow.session_id;
    const attendCourseStubcode = modeRow.course_stubcode;

    // 2. Resolve the student from the card
    const { data: studentCard, error: studentErr } = await supabase
      .from("student_cards")
      .select("student_id")
      .eq("nfc_uid", payload.nfc_uid)
      .single();

    if (studentErr || !studentCard) {
      await supabase.from("scan_logs").insert({
        scanned_at: new Date(payload.timestamp * 1000).toISOString(),
        room: deviceRoom,
        nfc_uid: payload.nfc_uid,
        mode: 'attend',
        result: 'unknown_card',
        student_id: null,
        course_stubcode: attendCourseStubcode,
        session_id: attendSessionId,
      });
      return 'unknown_card';
    }

    const studentId = studentCard.student_id;

    // 3. Find the enrollment: course_stubcode + student_id + dropped_at IS NULL
    const { data: enrollment, error: enrollErr } = await supabase
      .from("enrollments")
      .select("*")
      .eq("course_stubcode", attendCourseStubcode)
      .eq("student_id", studentId)
      .eq("dropped_at", null)
      .single();

    if (enrollErr || !enrollment) {
      // Not enrolled — do not touch attendance
      await supabase.from("scan_logs").insert({
        scanned_at: new Date(payload.timestamp * 1000).toISOString(),
        room: deviceRoom,
        nfc_uid: payload.nfc_uid,
        mode: 'attend',
        result: 'not_enrolled',
        student_id: studentId,
        course_stubcode: attendCourseStubcode,
        session_id: attendSessionId,
      });
      return 'not_enrolled';
    }

    // 4. Compute status from server time (Asia/Manila)
    const tapTime = new Date(payload.timestamp * 1000);
    const tz = 'Asia/Manila';
    const tapLocalMs = tapTime.toLocaleString('en-US', { timeZone: tz }, undefined).replace(/[^\d]/g, '') * 1; // hack: get epoch ms
    // Actually let me do this properly:
    const tapDateStr = new Date(payload.timestamp * 1000).toLocaleString('en-US', { timeZone: tz });
    const tapTimeParts = tapDateStr.split(' ');
    const tapTimePart = tapTimeParts[tapTimeParts.length - 1]; // HH:MM:SS or similar
    const tapHourMin = tapTimePart.split(':');
    const tapMinutes = parseInt(tapHourMin[0]) * 60 + parseInt(tapHourMin[1]);

    // Get the schedule slot for this session
    const { data: schedule, error: schedErr } = await supabase
      .from("stubcode_schedules")
      .select("late_after_minutes, absent_after_minutes, schedule_start, schedule_end")
      .eq("course_stubcode", attendCourseStubcode)
      .single();

  if (schedErr || !schedule) {
    await supabase.from("scan_logs").insert({
      scanned_at: new Date(payload.timestamp * 1000).toISOString(),
      room: deviceRoom,
      nfc_uid: payload.nfc_uid,
      mode: 'attend',
      result: 'rejected',
      student_id: studentId,
      course_stubcode: attendCourseStubcode,
      session_id: attendSessionId,
    });
    return 'rejected';
  }

  // Compute tap time as minutes after midnight in Asia/Manila
  // Parse the local time string
  const tapDate = new Date(payload.timestamp * 1000);
  const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' };
  const tapLocal = tapDate.toLocaleTimeString('en-CA', options); // HH:MM
  const tapHmParts = tapLocal.split(':');
  const tapMins = parseInt(tapHmParts[0]) * 60 + parseInt(tapHmParts[1]);

  // Schedule start as minutes after midnight
  const startParts = schedule.schedule_start.split(':');
  const scheduleStartMins = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);

  // Strictly greater than comparisons
  const lateThreshold = scheduleStartMins + schedule.late_after_minutes;
  const absentThreshold = scheduleStartMins + schedule.absent_after_minutes;

  let status: 'present' | 'late' | 'absent';
  if (tapMins >= absentThreshold) {
    status = 'absent';
  } else if (tapMins >= lateThreshold) {
    status = 'late';
  } else {
    status = 'present';
  }

  // 5. First tap wins; never overwrite an instructor-set row:
  const { error: updateErr } = await supabase.from("attendance").update({
    status,
    attendance_timestamp: new Date().toISOString(),
  }).eq("session_id", attendSessionId)
    .eq("enrollment_id", enrollment.enrollment_id)
    .eq("attendance_timestamp", null)
    .eq("source", 'system');

  if (updateErr && updateErr.code !== UNIQUE_VIOLATION) {
    // 0 rows updated -> 'duplicate' (someone already tapped)
    await supabase.from("scan_logs").insert({
      scanned_at: new Date(payload.timestamp * 1000).toISOString(),
      room: deviceRoom,
      nfc_uid: payload.nfc_uid,
      mode: 'attend',
      result: 'duplicate',
      student_id: studentId,
      course_stubcode: attendCourseStubcode,
      session_id: attendSessionId,
    });
    return 'duplicate';
  }

  // 1 row updated -> 'ok'
  await supabase.from("scan_logs").insert({
    scanned_at: new Date(payload.timestamp * 1000).toISOString(),
    room: deviceRoom,
    nfc_uid: payload.nfc_uid,
    mode: 'attend',
    result: 'ok',
    student_id: studentId,
    course_stubcode: attendCourseStubcode,
    session_id: attendSessionId,
  });

  return 'ok';
  } else {
    // No room_modes row -> no active mode
    await supabase.from("scan_logs").insert({
      scanned_at: new Date(payload.timestamp * 1000).toISOString(),
      room: deviceRoom,
      nfc_uid: payload.nfc_uid,
      mode: null,
      result: 'no_active_mode',
      student_id: null,
      course_stubcode: session.stub_code,
      session_id: session.session_id,
    });
    return 'no_active_mode';
  }

  // 5. Return result to firmware
  return new Response(JSON.stringify({ result, attendance_status: result }), {
    status: 201,
  });
});