#pragma once

#include <Arduino.h>

// Initializes the PN532 over I2C. Returns false if the module is not found.
bool nfcBegin();

// Blocks until a card tap is detected, then returns the UID as an
// uppercase hex string (e.g. "04A1B2C3D4"). Returns an empty string
// if no card was read within the internal timeout.
String nfcReadUid();

// Result of reading a registration-encoded MIFARE Classic 1K card
// (see docs/registration-mode-handoff.md — sectors 1+2's data blocks,
// 4-6 and 8-10 (block 7/11 are each sector's trailer, not data), JSON
// null-padded to 96 bytes). uid is set whenever a card was present,
// even if valid is false, so callers can still debounce/log by UID.
struct CardData {
  String uid;
  String schoolId;
  String firstName;
  String lastName;
  bool valid;  // false if auth/read failed or the JSON was malformed
};

// Like nfcReadUid(), but also authenticates sectors 1 and 2 with the
// default key and reads/parses the student_info JSON from their data
// blocks. Used in registration mode; nfcReadUid() stays the lighter
// attendance-mode path since it doesn't need the auth round trip.
CardData nfcReadData();

// Writes student JSON to MIFARE Classic sectors 1-2 (blocks 4-6, 8-10)
// using the factory default key. The JSON is null-padded to 96 bytes.
// Returns true on success, false if auth or write failed.
bool nfcWriteData(const String& schoolId, const String& firstName,
                  const String& lastName);
