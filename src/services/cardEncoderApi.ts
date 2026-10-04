// Talks to the local card-encoder bridge (tools/encoder_server.py).
// This is a purely local loopback tool: it needs no Supabase session,
// so the Encode Card page works signed in or out.

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

// Long timeout: the server blocks until a card is tapped on the reader
// (its own default is 60s; allow a little slack for the round trip).
export async function encodeCard(
  input: EncodeCardInput,
  timeoutMs = 75_000
): Promise<EncodeCardResult> {
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