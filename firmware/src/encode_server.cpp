#include "encode_server.h"

#include "config.h"
#include "led.h"
#include "nfc.h"
#include <ArduinoJson.h>
#include <WebServer.h>
#include <WiFi.h>

namespace {

WebServer server(ENCODER_HTTP_PORT);

// How long a POST /encode waits for a card to be tapped before giving
// up. nfcWriteData() itself only waits ~1s per attempt, so this loop is
// what turns it into a comfortable "tap now" window for the operator.
const unsigned long ENCODE_WAIT_MS = 30000;

void sendCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  // Chrome's Private Network Access: an HTTPS page reaching a private
  // address is a public->private request, and the preflight is blocked
  // unless the target opts in with this header.
  server.sendHeader("Access-Control-Allow-Private-Network", "true");
  server.sendHeader("Cache-Control", "no-store");
}

void sendJson(int status, const String &body) {
  sendCorsHeaders();
  server.send(status, "application/json", body);
}

void handlePreflight() {
  sendCorsHeaders();
  server.send(204, "text/plain", "");
}

void handleHealth() {
  // nfcpy is always false here — there is no Python bridge to report on.
  sendJson(200, F("{\"ok\":true,\"nfcpy\":false,\"reader\":true}"));
}

void handleEncode() {
  if (!server.hasArg("plain") || server.arg("plain").isEmpty()) {
    sendJson(400, F("{\"ok\":false,\"error\":\"empty request body\"}"));
    return;
  }

  JsonDocument request;
  if (deserializeJson(request, server.arg("plain"))) {
    sendJson(400, F("{\"ok\":false,\"error\":\"invalid json\"}"));
    return;
  }

  const String schoolId = request["school_id"] | "";
  const String firstName = request["first_name"] | "";
  const String lastName = request["last_name"] | "";

  if (schoolId.isEmpty()) {
    sendJson(400, F("{\"ok\":false,\"error\":\"school_id is required\"}"));
    return;
  }

  // Wait for a card, then write. Each nfcWriteData() call is a ~1s
  // presence check, so looping gives the operator a real tap window.
  bool written = false;
  const unsigned long startedAt = millis();
  while (millis() - startedAt < ENCODE_WAIT_MS) {
    if (nfcWriteData(schoolId, firstName, lastName)) {
      written = true;
      break;
    }
    delay(50);
  }

  if (!written) {
    ledIndicateInvalidUid();
    sendJson(504, F("{\"ok\":false,\"error\":\"no card tapped within 30s\"}"));
    return;
  }

  // Read the card straight back so the operator sees the UID that was
  // actually written, and a corrupt write is reported rather than
  // silently reported as success.
  const CardData verify = nfcReadData();

  JsonDocument response;
  response["ok"] = true;
  response["uid"] = verify.uid;
  response["school_id"] = schoolId;
  response["first_name"] = firstName;
  response["last_name"] = lastName;
  response["bytes_json"] = measureJson(request);

  String body;
  serializeJson(response, body);

  ledIndicateResult(200);
  sendJson(200, body);
}

void handleNotFound() {
  sendJson(404, F("{\"ok\":false,\"error\":\"unknown endpoint\"}"));
}

}  // namespace

void encodeServerBegin() {
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/health", HTTP_OPTIONS, handlePreflight);
  server.on("/encode", HTTP_POST, handleEncode);
  server.on("/encode", HTTP_OPTIONS, handlePreflight);
  server.onNotFound(handleNotFound);
  server.begin();

  Serial.printf("Encoder server listening on http://%s:%d\n",
                WiFi.localIP().toString().c_str(), ENCODER_HTTP_PORT);
  Serial.println("Point the dashboard's VITE_ENCODER_URL at that address.");
}

void encodeServerHandle() {
  server.handleClient();
}
