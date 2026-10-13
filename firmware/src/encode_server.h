#pragma once

#include <Arduino.h>

// A tiny HTTP server on the terminal itself, so the dashboard's Encode
// Card page can write cards by talking straight to the ESP32/PN532 —
// no desktop bridge (tools/encoder_server.py) in the loop.
//
// Endpoints (same shape the Python bridge exposed):
//   GET  /health  -> {"ok":true,"nfcpy":false,"reader":true}
//   POST /encode  -> {"school_id","first_name","last_name"} writes the
//                    card and returns {"ok":true,"uid",...}
//
// Both answer CORS preflights, including Chrome's
// Access-Control-Allow-Private-Network header, since the dashboard is
// served over HTTPS and the device sits on the private LAN.
void encodeServerBegin();

// Serves pending requests. Call once per loop() iteration; only blocks
// while an /encode request is waiting for a card to be tapped.
void encodeServerHandle();
