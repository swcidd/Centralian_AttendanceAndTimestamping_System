#include "time_sync.h"
#include <Arduino.h>   // configTime declared here in arduino-esp32 v3.x
#include <time.h>

static const char *NTP_SERVER = "pool.ntp.org";

void timeSyncBegin() {
  configTime(0, 0, NTP_SERVER);
}

unsigned long timeSyncNowUtc() {
  time_t now;
  time(&now);
  return static_cast<unsigned long>(now);
}
