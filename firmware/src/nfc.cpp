#include "nfc.h"
#include "pins.h"
#include <Adafruit_PN532.h>
#include <ArduinoJson.h>
#include <Wire.h>

namespace {
// Sector 1 (blocks 4-6) + sector 2 (blocks 8-10): 6 real data blocks,
// 96 bytes. Block 7 and block 11 are each sector's TRAILER (Key A +
// access bits + Key B) on MIFARE Classic — never data, on every
// sector, not something specific to this card. A single sector's 3
// usable blocks (48 bytes) isn't enough for realistic name lengths;
// the registration JSON payload for the doc's own example name runs
// 79 bytes with ordinary encoding.
const uint8_t REGISTRATION_DATA_BLOCKS[6] = {4, 5, 6, 8, 9, 10};
uint8_t defaultMifareKey[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
}  // namespace

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

CardData nfcReadData() {
  uint8_t uid[7];
  uint8_t uidLength;

  if (!nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength)) {
    return CardData{"", "", "", "", false};
  }

  String hex;
  for (uint8_t i = 0; i < uidLength; i++) {
    if (uid[i] < 0x10) hex += "0";
    hex += String(uid[i], HEX);
  }
  hex.toUpperCase();

  uint8_t payload[96];
  for (uint8_t i = 0; i < 6; i++) {
    uint8_t block = REGISTRATION_DATA_BLOCKS[i];
    // The library's keyNumber param is a boolean-ish selector, not the
    // raw PN532 command byte: internally it does
    // (keyNumber) ? MIFARE_CMD_AUTH_B : MIFARE_CMD_AUTH_A, so passing
    // MIFARE_CMD_AUTH_A here (0x60, truthy) actually selected Key B —
    // opposite of every comment in this file. 0 is Key A.
    if (!nfc.mifareclassic_AuthenticateBlock(uid, uidLength, block, 0,
                                              defaultMifareKey)) {
      Serial.printf("Registration card auth failed on block %d\n", block);
      return CardData{hex, "", "", "", false};
    }
    if (!nfc.mifareclassic_ReadDataBlock(block, payload + i * 16)) {
      Serial.printf("Registration card read failed on block %d\n", block);
      return CardData{hex, "", "", "", false};
    }
  }

  // JSON is null-padded to fill the 96-byte payload; trim at the first NUL.
  size_t len = 0;
  while (len < sizeof(payload) && payload[len] != 0) len++;

  // Try JSON first (encode_card.py output).
  const char *raw = reinterpret_cast<const char *>(payload);
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, raw, len);
  if (!err) {
    CardData result;
    result.uid = hex;
    result.schoolId = doc["school_id"].as<String>();
    result.firstName = doc["first_name"].as<String>();
    result.lastName = doc["last_name"].as<String>();
    result.valid = true;
    return result;
  }

  // Fallback: newline-separated plain text (school_id\nfirst_name\nlast_name)
  // as written by NFC Tools or similar apps.
  String text(raw, len);
  text.trim();
  String lines[3];
  int lineCount = 0;
  int start = 0;
  for (int i = 0; i <= (int)text.length() && lineCount < 3; i++) {
    if (i == (int)text.length() || text[i] == '\n') {
      String line = text.substring(start, i);
      line.trim();
      if (line.length() > 0) {
        lines[lineCount++] = line;
      }
      start = i + 1;
    }
  }

  if (lineCount == 3) {
    CardData result;
    result.uid = hex;
    result.schoolId = lines[0];
    result.firstName = lines[1];
    result.lastName = lines[2];
    result.valid = true;
    return result;
  }

  Serial.printf("Card data: not JSON and not 3-line plain text (%d lines)\n", lineCount);
  return CardData{hex, "", "", "", false};
}
