#pragma once

#include <Arduino.h>

// Posts the signed tap payload to API_ENDPOINT_URL over HTTPS.
// Returns the HTTP status code, or a negative HTTPClient error code if
// the request itself failed (e.g. connection refused, DNS failure).
int postTapEvent(const String &deviceMac, unsigned long timestamp, const String &nfcUid, const String &signature);

// Result of polling poll-commands for this device's oldest PENDING
// Device_Commands row (see 0001_core_schema.sql §8). present is false
// when there was nothing queued, or the request itself failed —
// callers don't need to distinguish "nothing pending" from "couldn't
// reach the backend this cycle" since the next poll ~5s later covers
// both the same way.
struct DeviceCommand {
  bool present;
  String commandType;
  String stubCode;
};

// Posts the signed poll request to POLL_COMMANDS_ENDPOINT_URL. The
// Edge Function atomically claims (reads + ACKs) the command server-side,
// so a successful response here means it won't be handed to this device
// again on the next poll.
DeviceCommand pollDeviceCommand(const String &deviceMac, unsigned long timestamp, const String &signature);
