#include "net.h"
#include "config.h"
#include <ArduinoJson.h>
#include <HTTPClient.h>

int postTapEvent(const String &deviceMac, unsigned long timestamp, const String &nfcUid,
                 const String &signature, const String &schoolId, const String &firstName,
                 const String &lastName) {
  JsonDocument doc;
  doc["device_mac"] = deviceMac;
  doc["nfc_uid"] = nfcUid;
  doc["timestamp"] = timestamp;
  doc["signature"] = signature;

  if (schoolId.length() > 0) {
    doc["student_info"]["school_id"] = schoolId;
    doc["student_info"]["first_name"] = firstName;
    doc["student_info"]["last_name"] = lastName;
  }

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.begin(API_ENDPOINT_URL);
  http.addHeader("Content-Type", "application/json");
  int statusCode = http.POST(body);
  http.end();

  return statusCode;
}
