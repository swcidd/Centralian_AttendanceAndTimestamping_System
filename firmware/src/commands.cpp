#include "commands.h"
#include "crypto.h"
#include "led.h"
#include "net.h"
#include "time_sync.h"
#include <WiFi.h>

namespace {
const unsigned long POLL_INTERVAL_MS = 5000;
unsigned long lastPollMillis = 0;
}  // namespace

void pollDeviceCommandsIfDue() {
  unsigned long now = millis();
  if (now - lastPollMillis < POLL_INTERVAL_MS) {
    return;
  }
  lastPollMillis = now;

  String deviceMac = WiFi.macAddress();
  unsigned long timestamp = timeSyncNowUtc();
  String signature = signDeviceMessage(deviceMac, timestamp);

  DeviceCommand command = pollDeviceCommand(deviceMac, timestamp, signature);
  if (!command.present) {
    return;
  }

  Serial.printf("Device command: %s (stub %s)\n", command.commandType.c_str(),
                command.stubCode.c_str());

  if (command.commandType == "START_ATTENDANCE") {
    registrationMode = false;
    ledIndicateSessionStart();
  } else if (command.commandType == "START_REGISTRATION") {
    registrationMode = true;
    ledIndicateRegistration();
  } else if (command.commandType == "END_SESSION") {
    registrationMode = false;
    ledIndicateSessionEnd();
  } else {
    // Any future command type isn't handled by this device yet —
    // leaving it ACKNOWLEDGED server-side (poll-commands already
    // claimed it) rather than silently retrying is a deliberate
    // tradeoff of the current minimal-edge design.
    Serial.printf("Unrecognized command type, ignoring: %s\n",
                  command.commandType.c_str());
  }
}
