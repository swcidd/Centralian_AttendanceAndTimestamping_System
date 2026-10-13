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

// Build-time default (Vite inlines VITE_ENCODER_URL at build). The reader
// is a LAN device on a DHCP lease, so this value is usually stale by the
// time anyone opens the page — it is only the fallback.
export const ENCODER_API_URL: string =
  (import.meta.env.VITE_ENCODER_URL as string | undefined)?.trim() ||
  DEFAULT_ENCODER_URL;

const ENCODER_URL_STORAGE_KEY = "cats.encoderUrl";

// The address the page should actually talk to right now: the operator's
// runtime override when one is saved, otherwise the build-time default.
export function getEncoderUrl(): string {
  try {
    return (
      window.localStorage.getItem(ENCODER_URL_STORAGE_KEY)?.trim() ||
      ENCODER_API_URL
    );
  } catch {
    return ENCODER_API_URL;
  }
}

// Persist a runtime override (blank clears it back to the build default).
export function setEncoderUrl(url: string): void {
  try {
    const trimmed = url.trim();
    if (trimmed) {
      window.localStorage.setItem(ENCODER_URL_STORAGE_KEY, trimmed);
    } else {
      window.localStorage.removeItem(ENCODER_URL_STORAGE_KEY);
    }
  } catch {
    // Storage disabled (private mode): keep using the build-time value.
  }
}

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
    const res = await fetch(`${getEncoderUrl()}/health`, {
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
    const res = await fetch(`${getEncoderUrl()}/encode`, {
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