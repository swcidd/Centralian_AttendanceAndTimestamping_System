#pragma once

#include <Arduino.h>

// Posts the signed tap payload to API_ENDPOINT_URL over HTTPS.
// Returns the HTTP status code, or a negative HTTPClient error code if
// the request itself failed (e.g. connection refused, DNS failure).
// schoolId/firstName/lastName are only sent (as a nested student_info
// object) when schoolId is non-empty — registration mode passes them,
// attendance mode's existing 4-arg call sites are unaffected.
int postTapEvent(const String &deviceMac, unsigned long timestamp, const String &nfcUid,
                 const String &signature, const String &schoolId = "",
                 const String &firstName = "", const String &lastName = "");
