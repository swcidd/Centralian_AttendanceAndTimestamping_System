#include "net.h"

// Dry-run stub: prints the signed payload to Serial instead of
// POSTing to the Edge Function. Used for bench verification of
// the full WiFi → NTP → NFC → HMAC pipeline before the backend
// endpoint exists. Returns 200 so the LED shows green.

int postTapEvent(const String &deviceMac, unsigned long timestamp, const String &nfcUid,
                 const String &signature, const String &schoolId, const String &firstName,
                 const String &lastName) {
  Serial.println("[DRY RUN] Signed payload:");
  Serial.printf("  device_mac : %s\n", deviceMac.c_str());
  Serial.printf("  nfc_uid    : %s\n", nfcUid.c_str());
  Serial.printf("  timestamp  : %lu\n", timestamp);
  Serial.printf("  signature  : %s\n", signature.c_str());
  if (schoolId.length() > 0) {
    Serial.printf("  student    : %s %s (%s)\n", firstName.c_str(), lastName.c_str(),
                  schoolId.c_str());
  }
  Serial.println();
  return 200;
}

// Dry-run stub: no backend to poll yet, always reports nothing pending
// rather than hitting the network.
DeviceCommand pollDeviceCommand(const String &deviceMac, unsigned long timestamp,
                                const String &signature) {
  Serial.println("[DRY RUN] poll-commands request (not sent):");
  Serial.printf("  device_mac : %s\n", deviceMac.c_str());
  Serial.printf("  timestamp  : %lu\n", timestamp);
  Serial.printf("  signature  : %s\n", signature.c_str());
  Serial.println();
  return DeviceCommand{false, "", ""};
}
