#include <Arduino.h>
#include <Wire.h>
#include "pins.h"

// Bare I2C bus scanner — no PN532 library involved at all. Tells us
// whether anything acknowledges on the bus, independent of whatever
// the Adafruit_PN532 library is doing.
//
// Healthy setup prints the PN532 at 0x24 every cycle.
// Nothing found  -> wiring/power/mode-switch issue.
// Error code 4+  -> bus stuck (shorted SDA/SCL or missing pull-ups/GND).
//
// Build with: pio run -e i2c-scan -t upload -t monitor

namespace {

constexpr uint8_t kFirstAddr = 0x08;
constexpr uint8_t kLastAddr = 0x77;

const char* describeError(uint8_t code) {
  switch (code) {
    case 0: return "ACK";
    case 2: return "NACK on address";  // nobody home — normal, stays quiet
    case 3: return "NACK on data";
    case 4: return "other error (bus stuck?)";
    default: return "unknown error";
  }
}

void scanBus() {
  Serial.printf("Scanning I2C bus (SDA=GPIO%d, SCL=GPIO%d)...\n",
                PN532_SDA_PIN, PN532_SCL_PIN);

  uint8_t found = 0;
  for (uint8_t addr = kFirstAddr; addr <= kLastAddr; ++addr) {
    Wire.beginTransmission(addr);
    uint8_t err = Wire.endTransmission();
    if (err == 0) {
      ++found;
      if (addr == 0x24) {
        Serial.printf("  0x%02X  ACK  <- PN532 (expected address)\n", addr);
      } else {
        Serial.printf("  0x%02X  ACK  <- unknown device\n", addr);
      }
    } else if (err != 2) {
      // NACK-on-address just means no device lives there; anything else
      // signals a bus-level problem worth surfacing.
      Serial.printf("  0x%02X  %s (%d)\n", addr, describeError(err), err);
    }
  }

  if (found == 0) {
    Serial.println("  No devices responded.");
    Serial.println("  Checklist:");
    Serial.println("   - SDA -> GPIO8, SCL -> GPIO9 (not GPIO21/22)");
    Serial.println("   - PN532 VCC -> 3V3, shared GND with board");
    Serial.println("   - DIP switches in I2C mode (SW1=ON, SW2=OFF)");
  }
  Serial.println();
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(1000);
  Wire.begin(PN532_SDA_PIN, PN532_SCL_PIN);
  Serial.println("\ni2c-scan | NFCPass bus diagnostic");
}

void loop() {
  scanBus();
  delay(2000);
}
