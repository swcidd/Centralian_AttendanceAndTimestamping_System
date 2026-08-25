#include "nfc.h"
#include "pins.h"
#include <Adafruit_PN532.h>
#include <Wire.h>

static Adafruit_PN532 nfc(PN532_SDA_PIN, PN532_SCL_PIN);

bool nfcBegin() {
  nfc.begin();
  if (nfc.getFirmwareVersion() == 0) {
    return false;
  }
  nfc.SAMConfig();
  return true;
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
