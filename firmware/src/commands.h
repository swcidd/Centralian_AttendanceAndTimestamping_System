#pragma once

// True while a START_REGISTRATION command is active; false otherwise
// (including after START_ATTENDANCE/END_SESSION). Only the command
// handler inside pollDeviceCommandsIfDue() ever writes it; loop()
// reads it to pick attendance vs. registration handling. Defined at
// file scope in main.cpp (not inside its anonymous namespace) so it
// has external linkage and can be shared here — same extern-global
// pattern the codebase already uses for lastUid/lastTapMillis, just
// needing cross-file visibility this time.
extern bool registrationMode;

// Polls poll-commands for this device's oldest PENDING Device_Commands
// row (see 0001_core_schema.sql §8) at most once every ~5s, driven from
// loop() alongside tap handling. Non-blocking: a call before the
// interval has elapsed is a no-op, so it never delays tap reads.
void pollDeviceCommandsIfDue();
