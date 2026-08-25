#include <Arduino.h>
#include <WiFi.h>
#include "commands.h"
#include "config.h"
#include "crypto.h"
#include "led.h"
#include "net.h"
#include "nfc.h"
#include "time_sync.h"
#include "validation.h"

namespace {
const unsigned long WIFI_TIMEOUT_MS = 20000;
const unsigned long TAP_DEBOUNCE_MS = 3000;

String lastUid;
unsigned long lastTapMillis = 0;
}  // namespace

void setup() {
  Serial.begin(115200);
  ledBegin();

  // Init NFC first — bus is clean before WiFi radio starts drawing power.
  if (!nfcBegin()) {
    Serial.println("PN532 not found");
  }

  // Reduce WiFi TX power to ease 3.3V rail load.
  WiFi.setTxPower(WIFI_POWER_5dBm);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long wifiStartMillis = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - wifiStartMillis > WIFI_TIMEOUT_MS) {
      Serial.println("WiFi connect timed out, retrying...");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      wifiStartMillis = millis();
    }
    delay(500);
  }
  Serial.println("WiFi connected");

  timeSyncBegin();
}

void loop() {
  pollDeviceCommandsIfDue();

  String rawUid = nfcReadUid();
  if (rawUid.length() == 0) {
    lastUid = "";
    return;
  }

  UidValidation validation = validateUidFormat(rawUid);
  if (!validation.ok) {
    Serial.println("Rejected tap: " + validation.error);
    ledIndicateInvalidUid();
    return;
  }
  String uid = validation.uid;

  unsigned long now = millis();
  if (uid == lastUid && (now - lastTapMillis) < TAP_DEBOUNCE_MS) {
    return;
  }
  lastUid = uid;
  lastTapMillis = now;

  unsigned long timestamp = timeSyncNowUtc();
  String deviceMac = WiFi.macAddress();
  String signature = signPayload(deviceMac, timestamp, uid);

  int statusCode = postTapEvent(deviceMac, timestamp, uid, signature);
  Serial.printf("Tap %s -> HTTP %d\n", uid.c_str(), statusCode);
  ledIndicateResult(statusCode);
}
