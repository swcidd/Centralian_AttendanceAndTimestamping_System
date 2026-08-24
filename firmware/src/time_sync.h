#pragma once

// Synchronizes the ESP32 RTC against NTP so tap timestamps and the
// HMAC clock-skew check line up with the backend's UTC clock.
void timeSyncBegin();

// Returns the current UTC unix timestamp (seconds).
unsigned long timeSyncNowUtc();
