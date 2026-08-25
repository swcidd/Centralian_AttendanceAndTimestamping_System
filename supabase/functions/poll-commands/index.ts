import { createClient } from "jsr:@supabase/supabase-js@2";
import { isClockSkewValid, verifyDeviceSignature } from "../_shared/deviceAuth.ts";

// Lets a device fetch and claim its own oldest PENDING Device_Commands
// row (see 0001_core_schema.sql §8). The device has no Supabase Auth
// session — only its PSK — so it can't hit the RLS-gated table
// directly (SELECT is authenticated-only, and there's no client UPDATE
// policy for ACK at all). This mirrors ingest-tap's PSK-HMAC pattern
// instead of inventing a new trust model.
//
// Fetch-and-ACK happen atomically in one call via the
// claim_next_device_command() RPC (0005_claim_next_device_command.sql)
// — NOT a plain select-then-update, which would let two overlapping
// polls for the same device both claim the same row.

const PSK = Deno.env.get("DEVICE_PSK")!;

interface PollRequest {
  device_mac: string;
  timestamp: number;
  signature: string;
}

Deno.serve(async (req) => {
  const payload: PollRequest = await req.json();

  if (!isClockSkewValid(payload.timestamp)) {
    return new Response(JSON.stringify({ error: "clock skew too large" }), {
      status: 401,
    });
  }

  const message = `${payload.device_mac}${payload.timestamp}`;
  const validSignature = await verifyDeviceSignature(
    PSK,
    message,
    payload.signature
  );
  if (!validSignature) {
    return new Response(JSON.stringify({ error: "invalid signature" }), {
      status: 401,
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: claimed, error: claimError } = await supabase
    .rpc("claim_next_device_command", { p_device_mac: payload.device_mac })
    .maybeSingle();

  if (claimError) {
    return new Response(JSON.stringify({ error: claimError.message }), {
      status: 500,
    });
  }
  if (!claimed) {
    return new Response(JSON.stringify({ command: null }), { status: 200 });
  }

  return new Response(
    JSON.stringify({
      command: {
        command_type: claimed.command_type,
        stub_code: claimed.stub_code,
      },
    }),
    { status: 200 }
  );
});
