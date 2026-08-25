#pragma once

#include <Arduino.h>

void ledBegin();

// Blinks the status LED to indicate the result of a tap POST, based on
// the HTTP status code from postTapEvent():
//   1 blink  = accepted (2xx)
//   2 blinks = no active attendance session for this device (409)
//   3 blinks = anything else (rejected signature, network failure, ...)
void ledIndicateResult(int statusCode);
