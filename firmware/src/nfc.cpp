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

  Serial.printf("[nfcReadData] Card detected: %s — attempting sector read...\n", hex.c_str());

  // Probe common MIFARE Classic keys (Key A, then Key B).
  uint8_t keys[][6] = {
    {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF},  // factory default
    {0xD3, 0xF7, 0xD3, 0xF7, 0xD3, 0xF7},  // NFC Forum NDEF
    {0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5},  // MAD / CUID
    {0x00, 0x00, 0x00, 0x00, 0x00, 0x00},  // all zeros
  };
  uint8_t *workingKey = nullptr;
  uint8_t  workingKeyNum = 0;  // 0 = Key A

  uint8_t payload[96];
  for (uint8_t i = 0; i < 6; i++) {
    uint8_t block = REGISTRATION_DATA_BLOCKS[i];

    if (i == 0) {
      bool authed = false;
      for (auto &key : keys) {
        // Try Key A first
        if (nfc.mifareclassic_AuthenticateBlock(uid, uidLength, block, 0, key)) {
          workingKey = key;
          workingKeyNum = 0;
          Serial.printf("[nfcReadData] Auth OK with Key A: %02X%02X%02X%02X%02X%02X\n",
                        key[0], key[1], key[2], key[3], key[4], key[5]);
          authed = true;
          break;
        }
        // Try Key B
        if (nfc.mifareclassic_AuthenticateBlock(uid, uidLength, block, 1, key)) {
          workingKey = key;
          workingKeyNum = 1;
          Serial.printf("[nfcReadData] Auth OK with Key B: %02X%02X%02X%02X%02X%02X\n",
                        key[0], key[1], key[2], key[3], key[4], key[5]);
          authed = true;
          break;
        }
      }
      if (!authed) {
        Serial.println("[nfcReadData] Auth FAILED — none of the 8 key combos worked (4 keys x A/B)");
        return CardData{hex, "", "", "", false};
      }
    } else if (!nfc.mifareclassic_AuthenticateBlock(uid, uidLength, block, workingKeyNum, workingKey)) {
      Serial.printf("[nfcReadData] Auth FAILED on block %d with working key\n", block);
      return CardData{hex, "", "", "", false};
    }

    if (!nfc.mifareclassic_ReadDataBlock(block, payload + i * 16)) {
      Serial.printf("[nfcReadData] Read FAILED on block %d\n", block);
      return CardData{hex, "", "", "", false};
    }
  }
  Serial.println("[nfcReadData] All 6 blocks read OK");

  // JSON is null-padded to fill the 96-byte payload; trim at the first NUL.
  size_t len = 0;
  while (len < sizeof(payload) && payload[len] != 0) len++;

  // Debug: show raw bytes for diagnosing card format issues
  Serial.printf("Card raw (%d bytes): ", len);
  for (size_t i = 0; i < len; i++) {
    if (payload[i] >= 32 && payload[i] < 127) {
      Serial.print((char)payload[i]);
    } else {
      Serial.printf("\\x%02x", payload[i]);
    }
  }
  Serial.println();

  // --- Try 1: JSON scan (encode_card.py or NFC Tools NDEF with possible prefix) ---
  // Scan raw payload for the first '{' to handle NDEF Text Records that have
  // a language prefix (e.g. "en{...}" from NFC Tools).
  const char *raw = reinterpret_cast<const char *>(payload);
  size_t jsonStart = 0;
  while (jsonStart < len && raw[jsonStart] != '{') jsonStart++;

  if (jsonStart < len) {
    if (jsonStart > 0) {
      Serial.printf("NDEF prefix detected: %d bytes before JSON\n", jsonStart);
    }
    // Find the matching closing brace
    size_t jsonEnd = len - 1;
    while (jsonEnd > jsonStart && raw[jsonEnd] != '}') jsonEnd--;

    if (jsonEnd > jsonStart) {
      size_t jsonLen = jsonEnd - jsonStart + 1;
      JsonDocument doc;
      DeserializationError err = deserializeJson(doc, raw + jsonStart, jsonLen);
      if (!err) {
        CardData result;
        result.uid = hex;
        result.schoolId = doc["school_id"].as<String>();
        result.firstName = doc["first_name"].as<String>();
        result.lastName = doc["last_name"].as<String>();
        result.valid = true;
        Serial.printf("Parsed JSON: school_id=%s name=%s %s\n",
                      result.schoolId.c_str(), result.firstName.c_str(),
                      result.lastName.c_str());
        return result;
      }
      Serial.printf("JSON parse failed at offset %d: %s\n", jsonStart, err.c_str());
    } else {
      Serial.println("No closing brace found after '{'");
    }
  } else {
    Serial.println("No '{' found in card payload — treating as plain text");
  }

  // --- Try 2: newline-separated plain text (school_id\nfirst_name\nlast_name) ---
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
    Serial.printf("Parsed plain text: school_id=%s name=%s %s\n",
                  result.schoolId.c_str(), result.firstName.c_str(),
                  result.lastName.c_str());
    return result;
  }

  Serial.printf("Card data: not JSON and not 3-line plain text (%d lines)\n", lineCount);
  return CardData{hex, "", "", "", false};
}

bool nfcWriteData(const String& schoolId, const String& firstName,
                  const String& lastName) {
  uint8_t uid[7];
  uint8_t uidLength;

  Serial.println("[nfcWriteData] Tap a card to write...");
  if (!nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength)) {
    return false;
  }

  String hex;
  for (uint8_t i = 0; i < uidLength; i++) {
    if (uid[i] < 0x10) hex += "0";
    hex += String(uid[i], HEX);
  }
  hex.toUpperCase();
  Serial.printf("[nfcWriteData] Card detected: %s\n", hex.c_str());

  // Build JSON payload
  JsonDocument doc;
  doc["school_id"] = schoolId;
  doc["first_name"] = firstName;
  doc["last_name"] = lastName;
  String json;
  serializeJson(doc, json);

  if (json.length() > 96) {
    Serial.printf("[nfcWriteData] JSON too large: %d bytes (max 96)\n", json.length());
    return false;
  }
  Serial.printf("[nfcWriteData] JSON: %s (%d bytes)\n", json.c_str(), json.length());

  // Pad to 96 bytes with nulls
  uint8_t payload[96];
  memset(payload, 0, sizeof(payload));
  memcpy(payload, json.c_str(), json.length());

  // Authenticate and write all 6 data blocks
  for (uint8_t i = 0; i < 6; i++) {
    uint8_t block = REGISTRATION_DATA_BLOCKS[i];
    if (!nfc.mifareclassic_AuthenticateBlock(uid, uidLength, block, 0,
                                              defaultMifareKey)) {
      Serial.printf("[nfcWriteData] Auth FAILED on block %d\n", block);
      return false;
    }
    if (!nfc.mifareclassic_WriteDataBlock(block, payload + i * 16)) {
      Serial.printf("[nfcWriteData] Write FAILED on block %d\n", block);
      return false;
    }
    Serial.printf("[nfcWriteData] Block %d written OK\n", block);
  }

  Serial.printf("[nfcWriteData] Success — %d bytes written to sectors 1-2\n", json.length());
  return true;
}
