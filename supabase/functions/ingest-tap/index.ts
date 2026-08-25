import { createClient } from "jsr:@supabase/supabase-js@2";

const PSK = Deno.env.get("DEVICE_PSK")!;
const MAX_CLOCK_SKEW_SECONDS = 30;
const UNIQUE_VIOLATION = "23505";

interface TapPayload {
  device_mac: string;
  nfc_uid: string;
  timestamp: number;
  signature: string;
}

async function verifySignature(payload: TapPayload): Promise<boolean> {
  const message = `${payload.device_mac}${payload.timestamp}${payload.nfc_uid}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(PSK),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  const expected = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expected === payload.signature.toLowerCase();
}

Deno.serve(async (req) => {
  const payload: TapPayload = await req.json();

  const skewSeconds = Math.abs(Date.now() / 1000 - payload.timestamp);
  if (skewSeconds > MAX_CLOCK_SKEW_SECONDS) {
    return new Response(JSON.stringify({ error: "clock skew too large" }), {
      status: 401,
    });
  }

  const validSignature = await verifySignature(payload);
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
    .select("session_id, stub_code, started_at")
    .eq("device_mac", payload.device_mac)
    .eq("status", "ACTIVE_ATTENDANCE")
    .maybeSingle();

  if (sessionError) {
    return new Response(JSON.stringify({ error: sessionError.message }), {
      status: 500,
    });
  }
  if (!session) {
    return new Response(
      JSON.stringify({ error: "no active attendance session for this device" }),
      { status: 409 }
    );
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

  const tapTime = new Date(payload.timestamp * 1000);
  const lateAfterMinutes = course?.late_after_minutes ?? null;
  const isLate =
    student != null &&
    lateAfterMinutes != null &&
    tapTime.getTime() >=
      new Date(session.started_at).getTime() + lateAfterMinutes * 60_000;

  const status = student == null ? "UNKNOWN" : isLate ? "LATE" : "PRESENT";

  const { error: insertError } = await supabase.from("attendance_logs").insert({
    session_id: session.session_id,
    student_id: student?.student_id ?? null,
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
