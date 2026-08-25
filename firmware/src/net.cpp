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

DeviceCommand pollDeviceCommand(const String &deviceMac, unsigned long timestamp, const String &signature) {
  DeviceCommand result{false, "", ""};

  JsonDocument doc;
  doc["device_mac"] = deviceMac;
  doc["timestamp"] = timestamp;
  doc["signature"] = signature;

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.begin(POLL_COMMANDS_ENDPOINT_URL);
  http.addHeader("Content-Type", "application/json");
  int statusCode = http.POST(body);

  if (statusCode == 200) {
    JsonDocument response;
    deserializeJson(response, http.getString());
    if (!response["command"].isNull()) {
      result.present = true;
      result.commandType = response["command"]["command_type"].as<String>();
      result.stubCode = response["command"]["stub_code"].as<String>();
    }
  }

  http.end();
  return result;
}
