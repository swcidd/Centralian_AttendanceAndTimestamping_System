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

// Drops a row into the Device_Commands mailbox (see 0001_core_schema.sql
// §8) so the terminal's next ~5s poll picks it up. The device isn't the
// security boundary for attendance — ingest-tap independently gates every
// tap against Active_Sessions regardless of whether this command ever
// reaches it — this is purely the "tell the device to change mode" signal.
async function queueDeviceCommand(
  deviceMac: string,
  stubCode: string,
  commandType: "START_ATTENDANCE" | "END_SESSION"
): Promise<void> {
  const { error } = await supabase.from("device_commands").insert({
    device_mac: deviceMac,
    stub_code: stubCode,
    command_type: commandType,
  });

  if (error) throw error;
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

  await queueDeviceCommand(deviceMac, stubCode, "START_ATTENDANCE");
}

export async function closeSession(sessionId: string): Promise<void> {
  const { data, error } = await supabase
    .from("active_sessions")
    .update({ status: "CLOSED" })
    .eq("session_id", sessionId)
    .select("stub_code, device_mac")
    .single();

  if (error) throw error;

  await queueDeviceCommand(data.device_mac, data.stub_code, "END_SESSION");
}
