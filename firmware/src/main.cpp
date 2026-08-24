#include <Arduino.h>
#include <WiFi.h>
#include "config.h"
#include "crypto.h"
#include "net.h"
#include "nfc.h"
#include "time_sync.h"

void setup() {
  Serial.begin(115200);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }

  timeSyncBegin();

  if (!nfcBegin()) {
    Serial.println("PN532 not found");
  }
}

void loop() {
  String uid = nfcReadUid();
  if (uid.length() == 0) {
    return;
  }

  unsigned long timestamp = timeSyncNowUtc();
  String deviceMac = WiFi.macAddress();
  String signature = signPayload(deviceMac, timestamp, uid);

  postTapEvent(deviceMac, timestamp, uid, signature);
}
