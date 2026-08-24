#pragma once

#include <Arduino.h>

// Initializes the PN532 over I2C. Returns false if the module is not found.
bool nfcBegin();

// Blocks until a card tap is detected, then returns the UID as an
// uppercase hex string (e.g. "04A1B2C3D4"). Returns an empty string
// if no card was read within the internal timeout.
String nfcReadUid();
