#include "nfc.h"
#include "pins.h"
#include <Adafruit_PN532.h>
#include <Wire.h>

// (irq, reset) — not (sda, scl); this library has no SDA/SCL-taking
// constructor. -1/-1 because this board's IRQ/RSTO pins aren't wired;
// I2C pins are set explicitly via Wire.begin() below instead. Passing
// PN532_SDA_PIN/PN532_SCL_PIN here previously made the library treat
// GPIO9 (SCL) as a reset output and toggle it on every begin(),
// corrupting the I2C bus before any real transaction could happen.
static Adafruit_PN532 nfc(-1, -1);

bool nfcBegin() {
  Wire.begin(PN532_SDA_PIN, PN532_SCL_PIN);
  Wire.setClock(100000);  // 100 kHz — more robust under WiFi RF noise
  nfc.begin();

  // Retry getFirmwareVersion — WiFi TX can momentarily corrupt the bus
  for (int attempt = 0; attempt < 3; ++attempt) {
    if (nfc.getFirmwareVersion() != 0) {
      nfc.SAMConfig();
      return true;
    }
    delay(200);
  }
  return false;
}

String nfcReadUid() {
  uint8_t uid[7];
  uint8_t uidLength;

  bool success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength);
  if (!success) {
    return "";
  }

  String hex;
  for (uint8_t i = 0; i < uidLength; i++) {
    if (uid[i] < 0x10) hex += "0";
    hex += String(uid[i], HEX);
  }
  hex.toUpperCase();
  return hex;
}
