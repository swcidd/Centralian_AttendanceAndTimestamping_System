#pragma once

#include <Arduino.h>

// Result of validating a raw UID read off the PN532 before it's signed
// and sent. Pure — same input always produces the same result, no I/O.
// Checks the UID is well-formed, not whether it belongs to a registered
// student — that identity check is server-side (see ingest-tap) and
// mirrored on the frontend by the differently-named validateUid() in
// src/services/validation.ts, which looks up a UID against the roster.
struct UidValidation {
  bool ok;
  String uid;    // normalized (uppercase) UID, set when ok is true
  String error;  // reason for rejection, set when ok is false
};

// ISO14443A UIDs read by the PN532 are 4, 7, or 10 bytes (8/14/20 hex
// chars). Rejects anything else or non-hex characters before it's ever
// signed or sent over the network.
UidValidation validateUidFormat(const String &rawUid);
