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
bool writeMode = false;
String pendingSchoolId, pendingFirstName, pendingLastName;

void printTapHeader(const char* mode) {
  Serial.println();
  Serial.println(F("========================================"));
  Serial.printf(  "  NFC CARD SCANNED [%s]\n", mode);
  Serial.println(F("========================================"));
}

void printCardData(const CardData& card, unsigned long timestamp,
                   const String& deviceMac, const String& signature,
                   int statusCode) {
  Serial.printf("  UID         : %s\n", card.uid.c_str());
  if (card.valid) {
    Serial.printf("  Name        : %s %s\n", card.firstName.c_str(), card.lastName.c_str());
    Serial.printf("  School ID   : %s\n", card.schoolId.c_str());
    Serial.printf("  Card Data   : VALID (JSON parsed)\n");
  } else {
    Serial.println(F("  Name        : (unknown card)"));
    Serial.println(F("  School ID   : -"));
    Serial.println(F("  Card Data   : NO DATA — card has no JSON written to sectors 1-2"));
    Serial.println(F("  Write JSON  : {\"school_id\":\"...\",\"first_name\":\"...\",\"last_name\":\"...\"}"));
  }
  Serial.printf("  Timestamp   : %lu\n", timestamp);
  Serial.printf("  Device MAC  : %s\n", deviceMac.c_str());
  Serial.printf("  Signature   : %.16s...\n", signature.c_str());
  Serial.printf("  HTTP Status : %d\n", statusCode);
  Serial.println(F("========================================"));
  Serial.println();
}

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

  // Check serial for WRITE command: WRITE|school_id|first_name|last_name
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.startsWith("WRITE|")) {
      // Parse: WRITE|school_id|first_name|last_name
      int p1 = line.indexOf('|', 6);
      int p2 = line.indexOf('|', p1 + 1);
      if (p1 > 0 && p2 > p1) {
        pendingSchoolId = line.substring(6, p1);
        pendingFirstName = line.substring(p1 + 1, p2);
        pendingLastName = line.substring(p2 + 1);
        writeMode = true;
        Serial.printf("WRITE MODE: school_id=%s name=%s %s\n",
                      pendingSchoolId.c_str(), pendingFirstName.c_str(),
                      pendingLastName.c_str());
        Serial.println("Tap a card to write...");
      } else {
        Serial.println("Usage: WRITE|school_id|first_name|last_name");
      }
    } else if (line == "CANCEL") {
      writeMode = false;
      Serial.println("Write mode cancelled.");
    }
  }

  // Write mode: wait for card tap, write JSON
  if (writeMode) {
    bool ok = nfcWriteData(pendingSchoolId, pendingFirstName, pendingLastName);
    writeMode = false;
    if (ok) {
      Serial.println("Card written successfully. Tap to verify:");
      delay(1500);
      CardData verify = nfcReadData();
      if (verify.uid.length() > 0) {
        if (verify.valid) {
          Serial.printf("VERIFY OK: %s %s (%s)\n", verify.firstName.c_str(),
                        verify.lastName.c_str(), verify.schoolId.c_str());
        } else {
          Serial.println("VERIFY FAILED: card could not be read back");
        }
      }
    } else {
      Serial.println("Card write failed.");
    }
    return;
  }

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
    printTapHeader("REGISTER");
    printCardData(card, timestamp, deviceMac, signature, statusCode);
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
  } else {
    statusCode = postTapEvent(deviceMac, timestamp, uid, signature);
  }
  printTapHeader("ATTENDANCE");
  printCardData(card, timestamp, deviceMac, signature, statusCode);
  ledIndicateResult(statusCode);
}
