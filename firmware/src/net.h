#pragma once

#include <Arduino.h>

// Posts the signed tap payload to API_ENDPOINT_URL over HTTPS.
// Returns true on a 2xx response.
bool postTapEvent(const String &deviceMac, unsigned long timestamp, const String &nfcUid, const String &signature);
