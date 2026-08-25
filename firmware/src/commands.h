#pragma once

// Polls poll-commands for this device's oldest PENDING Device_Commands
// row (see 0001_core_schema.sql §8) at most once every ~5s, driven from
// loop() alongside tap handling. Non-blocking: a call before the
// interval has elapsed is a no-op, so it never delays tap reads.
void pollDeviceCommandsIfDue();
