// Talks to the card reader over HTTP. The reader is normally the ESP32
// terminal itself (it serves /health and /encode — see
// firmware/src/encode_server.cpp), so nothing has to be running on the
// desktop; point VITE_ENCODER_URL at the device.
//
// tools/encoder_server.py still implements the same two endpoints for
// bench work on a PC with a USB reader, and remains the default so an
// existing setup keeps working unchanged.
//
// This is a purely local/LAN tool: it needs no Supabase session, so the
// Encode Card page works signed in or out.

const DEFAULT_ENCODER_URL = "http://localhost:8787";

export const ENCODER_API_URL: string =
  (import.meta.env.VITE_ENCODER_URL as string | undefined)?.trim() ||
  DEFAULT_ENCODER_URL;

export interface EncoderHealth {
  ok: boolean;
  nfcpy: boolean;
  reader: boolean;
}

export interface EncodeCardInput {
  schoolId: string;
  firstName: string;
  lastName: string;
}

export interface EncodeCardResult {
  ok: boolean;
  uid?: string;
  product?: string;
  size?: number;
  school_id?: string;
  first_name?: string;
  last_name?: string;
  bytes_json?: number;
  error?: string;
}

// Short timeout: this only checks whether the local server is up, so we
// never want the page to hang waiting for it.
export async function fetchEncoderHealth(
  timeoutMs = 3000
): Promise<EncoderHealth> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${ENCODER_API_URL}/health`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Encoder server responded ${res.status}`);
    return (await res.json()) as EncoderHealth;
  } finally {
    clearTimeout(timer);
  }
}

// Long timeout: the reader blocks until a card is tapped on it (the
// local bridge's own default is 60s; allow a little slack for the round
// trip).
//
// skipServer: write straight to the reader instead of routing through
// the local bridge. The endpoint is the same (`VITE_ENCODER_URL`), so
// pointing it at the ESP32/PN532 removes the need to run
// tools/encoder_server.py at all; this flag only tells the caller not to
// gate the write on a separate health probe.
export async function encodeCard(
  input: EncodeCardInput,
  timeoutMs = 75_000,
  skipServer = false
): Promise<EncodeCardResult> {
  void skipServer;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${ENCODER_API_URL}/encode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        school_id: input.schoolId,
        first_name: input.firstName,
        last_name: input.lastName,
      }),
      signal: controller.signal,
    });
    return (await res.json()) as EncodeCardResult;
  } finally {
    clearTimeout(timer);
  }
}