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

// File scope (not inside the anonymous namespace below) so it has
// external linkage — commands.h declares it extern, letting the
// command handler in commands.cpp flip it on START_REGISTRATION /
// off on START_ATTENDANCE and END_SESSION.
bool registrationMode = false;

namespace {
const unsigned long WIFI_TIMEOUT_MS = 20000;
const unsigned long TAP_DEBOUNCE_MS = 3000;

String lastUid;
unsigned long lastTapMillis = 0;

// WiFi.status() only reports the coarse wl_status_t categories (it
// collapsed our real failure into WL_DISCONNECTED, which just means
// "not connected" with no reason attached). The actual ESP-IDF
// disconnect reason + last-seen signal strength are only available via
// the lower-level event system — this is the standard way to get past
// that ceiling. arduino_event_id_t/arduino_event_info_t are this core
// version's actual names for what older Arduino-ESP32 docs call
// WiFiEvent_t/WiFiEventInfo_t (verified against the installed
// framework headers, not assumed from older examples).
void onWiFiEvent(arduino_event_id_t event, arduino_event_info_t info) {
  if (event == ARDUINO_EVENT_WIFI_STA_DISCONNECTED) {
    Serial.printf("WiFi disconnected, reason: %d, rssi: %d\n",
                  info.wifi_sta_disconnected.reason,
                  info.wifi_sta_disconnected.rssi);
  }
}
}  // namespace

void setup() {
  Serial.begin(115200);
  ledBegin();

  // Init NFC first — bus is clean before WiFi radio starts drawing power.
  if (!nfcBegin()) {
    Serial.println("PN532 not found");
  }

  WiFi.onEvent(onWiFiEvent);

  // Full power for the connection handshake itself — nfcBegin() above
  // has already finished by now, so there's nothing left to protect
  // from WiFi TX current draw at this point, and a weak signal here
  // only makes the initial connection less reliable for no benefit.
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long wifiStartMillis = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - wifiStartMillis > WIFI_TIMEOUT_MS) {
      // wl_status_t: 0=IDLE 1=NO_SSID_AVAIL(!) 2=SCAN_COMPLETED
      // 3=CONNECTED 4=CONNECT_FAILED(!) 5=CONNECTION_LOST 6=DISCONNECTED
      // NO_SSID_AVAIL means the SSID was never even seen (wrong name,
      // out of range, wrong band); CONNECT_FAILED specifically means
      // the AP rejected the handshake (wrong password, or an
      // enterprise/802.1X network that doesn't accept a plain PSK).
      Serial.printf("WiFi connect timed out (status=%d), retrying...\n",
                    WiFi.status());
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      wifiStartMillis = millis();
    }
    delay(500);
  }
  Serial.println("WiFi connected");
  Serial.println("MAC: " + WiFi.macAddress());

  // Only reduce TX power now, for the ongoing tap loop — this is what
  // actually needs protecting from WiFi bursts racing the PN532's I2C
  // reads once main.cpp's loop() starts running.
  WiFi.setTxPower(WIFI_POWER_5dBm);

  timeSyncBegin();
}

void loop() {
  pollDeviceCommandsIfDue();

  if (registrationMode) {
    CardData card = nfcReadData();
    if (card.uid.length() == 0) return;
    if (!card.valid) {
      Serial.println("Registration card unreadable or malformed");
      ledIndicateInvalidUid();
      return;
    }

    unsigned long now = millis();
    if (card.uid == lastUid && (now - lastTapMillis) < TAP_DEBOUNCE_MS) {
      return;
    }
    lastUid = card.uid;
    lastTapMillis = now;

    unsigned long timestamp = timeSyncNowUtc();
    String deviceMac = WiFi.macAddress();
    String signature = signPayload(deviceMac, timestamp, card.uid);

    int statusCode = postTapEvent(deviceMac, timestamp, card.uid, signature, card.schoolId,
                                  card.firstName, card.lastName);
    Serial.printf("Register %s (%s %s) -> HTTP %d\n", card.uid.c_str(),
                  card.firstName.c_str(), card.lastName.c_str(), statusCode);
    ledIndicateResult(statusCode);
    return;
  }

  CardData card = nfcReadData();
  if (card.uid.length() == 0) {
    lastUid = "";
    return;
  }

  UidValidation validation = validateUidFormat(card.uid);
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

  int statusCode;
  if (card.valid) {
    statusCode = postTapEvent(deviceMac, timestamp, uid, signature,
                              card.schoolId, card.firstName, card.lastName);
    Serial.printf("Tap %s (%s %s) -> HTTP %d\n", uid.c_str(),
                  card.firstName.c_str(), card.lastName.c_str(), statusCode);
  } else {
    statusCode = postTapEvent(deviceMac, timestamp, uid, signature);
    Serial.printf("Tap %s -> HTTP %d\n", uid.c_str(), statusCode);
  }
  ledIndicateResult(statusCode);
}
