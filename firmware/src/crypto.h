#pragma once

#include <Arduino.h>

// Computes HMAC_SHA256(PSK, MAC + Timestamp + NFC_UID) and returns it
// as a lowercase hex string, matching ingest-tap's verification input.
String signPayload(const String &deviceMac, unsigned long timestamp, const String &nfcUid);

// Computes HMAC_SHA256(PSK, MAC + Timestamp) and returns it as a
// lowercase hex string, matching poll-commands' verification input
// (same PSK, no NFC_UID in the signed message).
String signDeviceMessage(const String &deviceMac, unsigned long timestamp);
