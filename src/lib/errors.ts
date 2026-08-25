// Supabase throws PostgrestError/AuthError-shaped objects that are not
// `instanceof Error`, so `err instanceof Error` silently drops their
// message. Every thrown Supabase error still carries a string `message`,
// so read that structurally instead of relying on the Error subclass.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return fallback;
}
