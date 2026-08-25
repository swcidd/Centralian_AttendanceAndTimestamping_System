import { createClient } from "jsr:@supabase/supabase-js@2";

const PSK = Deno.env.get("DEVICE_PSK")!;
const MAX_CLOCK_SKEW_SECONDS = 30;

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

  // TODO: resolve student_id from payload.nfc_uid and session_id/stub_code
  // from the ACTIVE_ATTENDANCE session open for payload.device_mac before
  // inserting — both are NOT NULL on attendance_logs per the schema.
  const { error } = await supabase.from("attendance_logs").insert({
    nfc_uid: payload.nfc_uid,
    device_mac: payload.device_mac,
    timestamp: new Date(payload.timestamp * 1000).toISOString(),
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ status: "ok" }), { status: 201 });
});
