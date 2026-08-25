#include "net.h"
#include "config.h"
#include <ArduinoJson.h>
#include <HTTPClient.h>

int postTapEvent(const String &deviceMac, unsigned long timestamp, const String &nfcUid, const String &signature) {
  JsonDocument doc;
  doc["device_mac"] = deviceMac;
  doc["nfc_uid"] = nfcUid;
  doc["timestamp"] = timestamp;
  doc["signature"] = signature;

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.begin(API_ENDPOINT_URL);
  http.addHeader("Content-Type", "application/json");
  int statusCode = http.POST(body);
  http.end();

  return statusCode;
}
