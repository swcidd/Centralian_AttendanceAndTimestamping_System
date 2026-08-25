#pragma once

#include <Arduino.h>

// Initializes the onboard WS2812 RGB LED (GPIO48 on this board — see
// pins.h). Must be called once before either function below.
void ledBegin();

// Blinks the status LED to indicate the result of a tap POST, based on
// the HTTP status code from postTapEvent():
//   1 green blink   = accepted (2xx)
//   2 orange blinks = no active attendance session for this device (409)
//   3 red blinks    = anything else (rejected signature, network failure, ...)
void ledIndicateResult(int statusCode);

// 4 rapid red blinks — a UID failed validateUidFormat() and was
// rejected before it was ever signed or sent.
void ledIndicateInvalidUid();

// 2 blue blinks — a START_ATTENDANCE Device_Command was claimed via
// poll-commands. Blue is otherwise unused so it can't be confused
// with a tap result (green/orange/red).
void ledIndicateSessionStart();

// 1 blue blink — an END_SESSION Device_Command was claimed via
// poll-commands.
void ledIndicateSessionEnd();
