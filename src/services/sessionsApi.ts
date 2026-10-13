import { supabase } from "../lib/supabase";

export type SessionMode = "ACTIVE_ATTENDANCE" | "REGISTRATION";

export interface ActiveSession {
  sessionId: string;
  stubCode: string;
  deviceMac: string;
  status: SessionMode;
}

export async function getActiveSession(
  stubCode: string
): Promise<ActiveSession | null> {
  const { data, error } = await supabase
    .from("active_sessions")
    .select("session_id, stub_code, device_mac, status")
    .eq("stub_code", stubCode)
    .in("status", ["ACTIVE_ATTENDANCE", "REGISTRATION"])
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    sessionId: data.session_id,
    stubCode: data.stub_code,
    deviceMac: data.device_mac,
    status: data.status as SessionMode,
  };
}

// queueDeviceCommand is a no-op: the device-poll / command-ACK path
// was removed in favor of the stateless scan endpoint in ingest-tap.
// Keeping the stub for import compatibility; it does not persist data.
async function queueDeviceCommand(
  _deviceMac: string,
  _stubCode: string,
  _commandType: "START_ATTENDANCE" | "END_SESSION" | "START_REGISTRATION"
): Promise<void> {
  return;
}

export async function startSession(
  stubCode: string,
  deviceMac: string,
  mode: SessionMode = "ACTIVE_ATTENDANCE"
): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  // A session left open from an earlier run (page closed mid-session,
  // a crash, manual testing) would otherwise leave two open rows —
  // either for this stub (the 0009 index) or on this device now that
  // several stubcodes can share one terminal (the 0012 index) —
  // breaking the single-row lookups in getActiveSession() and
  // ingest-tap. Closing anything stale on this device or stub first
  // keeps starting a new one idempotent.
  const { error: closeStaleError } = await supabase
    .from("active_sessions")
    .update({ status: "CLOSED" })
    .or(`device_mac.eq.${deviceMac},stub_code.eq.${stubCode}`)
    .in("status", ["ACTIVE_ATTENDANCE", "REGISTRATION"]);
  if (closeStaleError) throw closeStaleError;

  const { error } = await supabase.from("active_sessions").insert({
    stub_code: stubCode,
    device_mac: deviceMac,
    status: mode,
    created_by: userData.user?.id,
  });

  if (error) throw error;

  const commandType =
    mode === "REGISTRATION" ? "START_REGISTRATION" : "START_ATTENDANCE";
  // queueDeviceCommand removed — polled command-ACK path deleted.
}

export async function closeSession(sessionId: string): Promise<void> {
  const { data, error } = await supabase
    .from("active_sessions")
    .update({ status: "CLOSED" })
    .eq("session_id", sessionId)
    .select("stub_code, device_mac")
    .single();

  if (error) throw error;

  // queueDeviceCommand removed — polled command-ACK path deleted.
}
