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

interface RegistrationSession {
  session_id: string;
  stub_code: string;
}

// A REGISTRATION-mode tap carries the card's own school_id/first_name/
// last_name (read off the card by the firmware, not typed by anyone),
// so it creates the Student row and enrolls them in one round trip —
// no separate "add student" step. Re-tapping an already-registered
// card just confirms/re-enrolls rather than erroring, since a student
// may legitimately tap once per course they're being registered into.
async function handleRegistration(
  supabase: SupabaseClient,
  session: RegistrationSession,
  payload: TapPayload
): Promise<Response> {
  if (!payload.student_info) {
    return new Response(
      JSON.stringify({ error: "registration mode requires student_info in payload" }),
      { status: 400 }
    );
  }

  const { school_id, first_name, last_name } = payload.student_info;

  const { data: existingStudent } = await supabase
    .from("students")
    .select("student_id")
    .eq("nfc_uid", payload.nfc_uid)
    .maybeSingle();

  let studentId: string;

  if (existingStudent) {
    studentId = existingStudent.student_id;
  } else {
    const { data: newStudent, error: insertError } = await supabase
      .from("students")
      .insert({
        student_id: school_id,
        first_name,
        last_name,
        nfc_uid: payload.nfc_uid,
      })
      .select("student_id")
      .single();

    if (insertError) {
      // Concurrent registration tap for the same new card can race here —
      // both requests see "no existing student" and both try to insert.
      // Whichever loses re-fetches by nfc_uid instead of failing outright.
      if (insertError.code === UNIQUE_VIOLATION) {
        const { data: raceWinner, error: refetchError } = await supabase
          .from("students")
          .select("student_id")
          .eq("nfc_uid", payload.nfc_uid)
          .single();
        if (refetchError) {
          return new Response(JSON.stringify({ error: refetchError.message }), {
            status: 500,
          });
        }
        studentId = raceWinner.student_id;
      } else {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
        });
      }
    } else {
      studentId = newStudent.student_id;
    }
  }

  const { error: enrollError } = await supabase.from("enrollments").upsert(
    { stub_code: session.stub_code, student_id: studentId },
    { onConflict: "stub_code,student_id", ignoreDuplicates: true }
  );

  if (enrollError) {
    return new Response(JSON.stringify({ error: enrollError.message }), {
      status: 500,
    });
  }

  return new Response(
    JSON.stringify({
      status: "registered",
      student: { student_id: studentId, school_id, first_name, last_name },
    }),
    { status: 201 }
  );
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

  const { data: session, error: sessionError } = await supabase
    .from("active_sessions")
    .select("session_id, stub_code, started_at, status")
    .eq("device_mac", payload.device_mac)
    .in("status", ["ACTIVE_ATTENDANCE", "REGISTRATION"])
    .maybeSingle();

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

  if (session.status === "REGISTRATION") {
    return await handleRegistration(supabase, session, payload);
  }

  const [{ data: course }, { data: student }] = await Promise.all([
    supabase
      .from("courses")
      .select("late_after_minutes")
      .eq("stub_code", session.stub_code)
      .maybeSingle(),
    supabase
      .from("students")
      .select("student_id")
      .eq("nfc_uid", payload.nfc_uid)
      .maybeSingle(),
  ]);

  let studentId = student?.student_id ?? null;

  // Auto-register: if the card carries student_info and no matching
  // student row exists yet, create it (and enroll them) on the fly so
  // attendance taps for pre-encoded cards aren't silently lost as UNKNOWN.
  if (studentId == null && payload.student_info) {
    const { school_id, first_name, last_name } = payload.student_info;

    const { data: newStudent, error: insertError } = await supabase
      .from("students")
      .insert({
        student_id: school_id,
        first_name,
        last_name,
        nfc_uid: payload.nfc_uid,
      })
      .select("student_id")
      .single();

    if (insertError) {
      if (insertError.code === UNIQUE_VIOLATION) {
        // Concurrent auto-registration or prior registration — fetch.
        const { data: existing } = await supabase
          .from("students")
          .select("student_id")
          .eq("nfc_uid", payload.nfc_uid)
          .single();
        studentId = existing?.student_id ?? null;
      } else {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
        });
      }
    } else {
      studentId = newStudent.student_id;
    }

    if (studentId) {
      await supabase.from("enrollments").upsert(
        { stub_code: session.stub_code, student_id: studentId },
        { onConflict: "stub_code,student_id", ignoreDuplicates: true }
      );
    }
  }

  const tapTime = new Date(payload.timestamp * 1000);
  const lateAfterMinutes = course?.late_after_minutes ?? null;
  const isLate =
    studentId != null &&
    lateAfterMinutes != null &&
    tapTime.getTime() >=
      new Date(session.started_at).getTime() + lateAfterMinutes * 60_000;

  const status = studentId == null ? "UNKNOWN" : isLate ? "LATE" : "PRESENT";

  const { error: insertError } = await supabase.from("attendance_logs").insert({
    session_id: session.session_id,
    student_id: studentId,
    stub_code: session.stub_code,
    nfc_uid: payload.nfc_uid,
    device_mac: payload.device_mac,
    status,
    timestamp: tapTime.toISOString(),
  });

  // A duplicate tap for a student already logged this session isn't an
  // error — the unique index (session_id, student_id) already recorded
  // their first tap, so this one is a harmless no-op.
  if (insertError && insertError.code !== UNIQUE_VIOLATION) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ status: "ok", attendance_status: status }), {
    status: 201,
  });
});
