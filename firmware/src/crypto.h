#pragma once

#include <Arduino.h>

// Computes HMAC_SHA256(PSK, MAC + Timestamp + NFC_UID) and returns it
// as a lowercase hex string, matching the backend's verification input.
String signPayload(const String &deviceMac, unsigned long timestamp, const String &nfcUid);
