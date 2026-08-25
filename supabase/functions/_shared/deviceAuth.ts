// PSK-HMAC verification shared by every device-facing Edge Function
// (ingest-tap, poll-commands). One place for the anti-spoofing logic
// so a future fix doesn't have to land in two functions in lockstep.

const MAX_CLOCK_SKEW_SECONDS = 30;

export function isClockSkewValid(timestamp: number): boolean {
  const skewSeconds = Math.abs(Date.now() / 1000 - timestamp);
  return skewSeconds <= MAX_CLOCK_SKEW_SECONDS;
}

export async function verifyDeviceSignature(
  psk: string,
  message: string,
  signature: string
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(psk),
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

  return expected === signature.toLowerCase();
}
