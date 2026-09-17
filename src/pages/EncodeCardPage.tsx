import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CgProfile } from "react-icons/cg";

import {
  ENCODER_API_URL,
  encodeCard,
  fetchEncoderHealth,
  type EncodeCardResult,
} from "../services/cardEncoderApi";

type Health = "checking" | "online" | "offline";
type Phase = "idle" | "waiting" | "success" | "error";

const inputClass =
  "border-tan text-navy placeholder:text-navy/50 focus:border-orange focus:ring-orange w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1";

const MAX_PAYLOAD_BYTES = 96;

// Same JSON shape the firmware reads back and tools/encode_card.py writes.
function payloadBytes(schoolId: string, firstName: string, lastName: string) {
  const json = JSON.stringify({
    school_id: schoolId,
    first_name: firstName,
    last_name: lastName,
  });
  return new TextEncoder().encode(json).length;
}

const EncodeCardPage = () => {
  const [health, setHealth] = useState<Health>("checking");
  const [phase, setPhase] = useState<Phase>("idle");
  const [schoolId, setSchoolId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [result, setResult] = useState<EncodeCardResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runHealthCheck = () =>
    fetchEncoderHealth()
      .then(() => setHealth("online"))
      .catch(() => setHealth("offline"));

  useEffect(() => {
    // Only async callbacks set state here — no synchronous setState in
    // the effect body (react-hooks/set-state-in-effect).
    void runHealthCheck();
  }, []);

  const checkHealth = () => {
    setHealth("checking");
    void runHealthCheck();
  };

  const bytes = payloadBytes(schoolId, firstName, lastName);
  const tooLarge = bytes > MAX_PAYLOAD_BYTES;
  const canSubmit =
    health === "online" &&
    phase !== "waiting" &&
    schoolId.trim() !== "" &&
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    !tooLarge;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setResult(null);
    setPhase("waiting");
    try {
      const response = await encodeCard({
        schoolId: schoolId.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      setResult(response);
      setPhase(response.ok ? "success" : "error");
      if (!response.ok) setError(response.error ?? "Encoding failed.");
    } catch (err) {
      setPhase("error");
      setError(
        err instanceof Error && err.name === "AbortError"
          ? "Timed out waiting for a card. Try again and tap the card promptly."
          : "Could not reach the local encoder. Is tools/encoder_server.py running?"
      );
    }
  };

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setError(null);
    setSchoolId("");
    setFirstName("");
    setLastName("");
  };

  return (
    <div className="bg-cream min-h-screen flex flex-col">
      <header className="border-tan bg-orange px-4 py-2 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-white">
          Centralian Attendance & Timestamping System
        </h1>
        <Link to="/login" className="text-sm font-medium text-white/90 hover:underline">
          Back to login
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="border-tan w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex justify-center">
            <CgProfile className="text-navy/70 text-7xl" />
          </div>

          <h2 className="text-navy text-center text-lg font-bold">Encode Student Card</h2>
          <p className="text-navy/60 mt-1 text-center text-sm">
            Writes student JSON to the next MIFARE card tapped on the
            computer running the local encoder.
          </p>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                health === "online"
                  ? "bg-green-500"
                  : health === "offline"
                    ? "bg-red-500"
                    : "bg-gray-400"
              }`}
            />
            <span className="text-navy/60">
              {health === "online"
                ? "Local encoder connected"
                : health === "offline"
                  ? "Local encoder not reachable"
                  : "Checking local encoder..."}
            </span>
            {health !== "checking" && (
              <button
                type="button"
                onClick={checkHealth}
                className="text-orange font-medium hover:underline"
              >
                Recheck
              </button>
            )}
          </div>

          {health === "offline" && (
            <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Start it with{" "}
              <code className="font-mono">python3 tools/encoder_server.py</code>{" "}
              on the machine with the USB NFC reader (expected at {ENCODER_API_URL}).
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            {phase === "waiting" && (
              <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
                Waiting for a card — tap it on the reader now...
              </p>
            )}

            {phase === "success" && result?.ok && (
              <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                <p className="font-medium">Card encoded.</p>
                <p className="mt-1">
                  UID <span className="font-mono">{result.uid}</span>
                  {result.bytes_json ? ` · ${result.bytes_json} bytes JSON` : ""}
                </p>
              </div>
            )}

            <input
              type="text"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              required
              placeholder="School ID (e.g. 25-1809-52)"
              className={inputClass}
            />
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              placeholder="First Name"
              className={inputClass}
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              placeholder="Last Name"
              className={inputClass}
            />

            <p className={`text-right text-xs ${tooLarge ? "text-red-600" : "text-navy/50"}`}>
              {bytes}/{MAX_PAYLOAD_BYTES} bytes
              {tooLarge ? " — too large for the card" : ""}
            </p>

            <div className="flex gap-3 pt-1">
              {phase === "success" ? (
                <button
                  type="button"
                  onClick={reset}
                  className="bg-orange flex-1 rounded-md px-3 py-2 text-sm font-medium text-white hover:brightness-95"
                >
                  Encode another
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="bg-orange flex-1 rounded-md px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
                >
                  {phase === "waiting" ? "Waiting for card..." : "Write to card"}
                </button>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default EncodeCardPage;