#pragma once

#include <Arduino.h>

// Posts the signed tap payload to API_ENDPOINT_URL over HTTPS.
// Returns the HTTP status code, or a negative HTTPClient error code if
// the request itself failed (e.g. connection refused, DNS failure).
int postTapEvent(const String &deviceMac, unsigned long timestamp, const String &nfcUid, const String &signature);
