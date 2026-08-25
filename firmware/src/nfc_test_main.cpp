#include <Arduino.h>
#include "nfc.h"

// Standalone PN532 smoke test — no WiFi/config.h/net/crypto involved.
// Build with `pio run -e nfc-test -t upload -t monitor`.

void setup() {
  Serial.begin(115200);
  delay(1000);

  if (!nfcBegin()) {
    Serial.println("PN532 not found - check I2C wiring and DIP switches (SW1=ON, SW2=OFF)");
  } else {
    Serial.println("PN532 found. Tap a card...");
  }
}

void loop() {
  String uid = nfcReadUid();
  if (uid.length() > 0) {
    Serial.println("UID: " + uid);
  }
  delay(200);
}
