import { supabase } from "../lib/supabase";

export interface ActiveSession {
  sessionId: string;
  stubCode: string;
  deviceMac: string;
}

export async function getActiveSession(
  stubCode: string
): Promise<ActiveSession | null> {
  const { data, error } = await supabase
    .from("active_sessions")
    .select("session_id, stub_code, device_mac")
    .eq("stub_code", stubCode)
    .eq("status", "ACTIVE_ATTENDANCE")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    sessionId: data.session_id,
    stubCode: data.stub_code,
    deviceMac: data.device_mac,
  };
}

export async function startSession(
  stubCode: string,
  deviceMac: string
): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const { error } = await supabase.from("active_sessions").insert({
    stub_code: stubCode,
    device_mac: deviceMac,
    status: "ACTIVE_ATTENDANCE",
    created_by: userData.user?.id,
  });

  if (error) throw error;
}

export async function closeSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("active_sessions")
    .update({ status: "CLOSED" })
    .eq("session_id", sessionId);

  if (error) throw error;
}
