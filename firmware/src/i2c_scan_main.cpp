#include <Arduino.h>
#include <Wire.h>
#include "pins.h"

// Bare I2C bus diagnostic for the PN532 — no Adafruit library
// involved, so it shows what's actually on the wire independently of
// whatever Adafruit_PN532 does.
//
// One healthy cycle prints:
//   [rise] SDA: 3 us -> healthy
//   [rise] SCL: 3 us -> healthy
//
//   i2c-scan | NFCPass bus diagnostic
//   Scanning I2C bus (SDA=GPIO8, SCL=GPIO9)...
//     [proto@100k fresh] wrote 9/9 bytes, endTransmission=0 (OK)
//     [proto@100k fresh] READY after 1 polls
//     [proto@100k fresh] ACK read: 7 bytes: 01 00 00 FF 00 FF 00
//     [proto@100k fresh] ACK frame OK
//     [proto@100k fresh] response read: 14 bytes: 01 00 00 FF 06 FA ...
//     [proto@100k fresh] *** PN532 IC=03 FW=1.2 *** PROTOCOL OK
//     0x24  ACK  <- PN532 (expected address)
//
// Faults at a glance:
//   rise >= 3ms             -> no pull-ups at all (line floats)
//   rise >= 10us            -> weak pull-ups / high capacitance
//   no 0x24 ACK             -> wiring / power / DIP switches (checklist
//                              is printed when nothing answers at all)
//   [proto] phase line fails-> which phase broke: write, ready-poll,
//                              ACK frame, or response frame
//   "driver timeout (wedged)" -> I2C driver wedged; the scan re-inits
//                              the bus every cycle, but a hard-stuck
//                              bus still needs a power cycle
//
// PN532 I2C read sequence (mirrors Adafruit_PN532 exactly):
// every read from the chip starts with a RDY (0x01) prefix byte; the
// chip first delivers its 6-byte ACK-of-command frame, and only after
// a second RDY poll does the real response arrive. Reading straight
// through the ACK in one oversized read (what the pre-fix version of
// this diagnostic did) over-reads the chip's FIFO and wedges the bus —
// the cascading "Error 263" timeouts and ghost addresses that follow
// are the symptom, not the disease.
//
// Build with: pio run -e i2c-scan -t upload -t monitor

namespace {

constexpr uint8_t kFirstAddr = 0x08;
constexpr uint8_t kLastAddr = 0x77;
constexpr uint8_t kPn532Addr = 0x24;
constexpr uint8_t kI2cReady = 0x01;  // RDY prefix on every PN532 read

// ACK-of-command frame the chip sends before the real response
// (Adafruit_PN532's pn532ack).
const uint8_t kAckFrame[6] = {0x00, 0x00, 0xFF, 0x00, 0xFF, 0x00};

const char* describeError(uint8_t code) {
  switch (code) {
    case 0: return "ACK";
    case 2: return "NACK on address";  // nobody home — normal, stays quiet
    case 3: return "NACK on data";
    case 4: return "other error (bus stuck?)";
    case 5: return "driver timeout (bus wedged)";
    default: return "unknown error";
  }
}

// Re-create the I2C driver from scratch. An aborted PN532 read leaves
// the ESP32 peripheral in a state where every later transaction fails
// with driver error 263 (ESP_ERR_TIMEOUT) / endTransmission=5 — which
// is how one bad read used to smear ghost errors across the whole
// address sweep. Called at the start of every scan cycle and on every
// probe failure so each attempt starts on a clean bus.
void resetBus() {
  Wire.end();
  Wire.begin(PN532_SDA_PIN, PN532_SCL_PIN);
  Wire.setClock(100000);
}

// Wait until the chip prefixes a read with RDY (0x01). Fast
// not-ready-yet NACKs are retried until the timeout; driver-level
// timeouts (each already cost ~1s) abort after two — the bus is
// physically stuck and retrying only stalls the scan.
bool pollReady(unsigned khz, const char* tag, uint16_t timeoutMs) {
  const unsigned long start = millis();
  unsigned long polls = 0;
  int wedged = 0;
  while (millis() - start < timeoutMs) {
    unsigned long t0 = millis();
    uint8_t n = Wire.requestFrom(kPn532Addr, (uint8_t)1);
    unsigned long took = millis() - t0;
    if (n == 1) {
      if (Wire.read() == kI2cReady) {
        Serial.printf("  [proto@%uk %s] READY after %lu polls\n",
                      khz, tag, polls);
        return true;
      }
    } else if (took > 100) {
      if (++wedged >= 2) {
        Serial.printf("  [proto@%uk %s] status poll wedged %dx — aborting attempt\n",
                      khz, tag, wedged);
        return false;
      }
    }
    ++polls;
    delay(10);
  }
  Serial.printf("  [proto@%uk %s] never became ready — aborting attempt\n",
                khz, tag);
  return false;
}

// Full GET_FIRMWARE_VERSION transaction — the same I2C conversation
// Adafruit_PN532 performs (sendCommandCheckAck + getFirmwareVersion):
//
//   1. write the command frame: 00 00 FF 02 FE D4 02 2A 00
//   2. poll for the RDY prefix (0x01)
//   3. read the ACK frame:  RDY + 00 00 FF 00 FF 00   <- comes FIRST
//   4. poll for RDY again
//   5. read the response:   RDY + 00 00 FF 06 FA D5 02 IC V1 V2 DCS 00
//
// Phase 3 is the one the pre-fix version skipped: a single oversized
// read after the first READY lands on the ACK frame instead of the
// response and wedges the chip/bus. Every failure path re-creates the
// I2C driver so the rest of the scan still runs.
//
// Runs at the requested clock so 100 kHz can be compared against
// slower tiers: a slow clock rescuing a failed phase is the signature
// of weak pull-ups (rise time can't keep up — single bits pass, data
// bursts and START edges don't).
//
// Returns true when the response frame validates ("PROTOCOL OK").
bool probeProtocol(uint32_t clockHz, unsigned khz, const char* tag) {
  Wire.setClock(clockHz);
  const uint8_t frame[] = {0x00, 0x00, 0xFF, 0x02, 0xFE,
                           0xD4, 0x02, 0x2A, 0x00};

  Serial.printf("  [proto@%uk %s] write GET_FIRMWARE_VERSION frame...\n", khz, tag);
  Wire.beginTransmission(kPn532Addr);
  size_t written = Wire.write(frame, sizeof(frame));
  uint8_t werr = Wire.endTransmission();
  Serial.printf("  [proto@%uk %s] wrote %u/%u bytes, endTransmission=%u%s\n",
                khz, tag, (unsigned)written, (unsigned)sizeof(frame), werr,
                werr == 0 ? " (OK)"
                          : werr == 5 ? " (TIMEOUT — bus wedged)" : " (FAIL)");
  if (werr != 0) {
    // Frame never made it onto the wire — polling would just burn
    // ~1s of driver timeouts for nothing.
    Serial.printf("  [proto@%uk %s] frame not accepted — aborting attempt\n",
                  khz, tag);
    resetBus();
    return false;
  }

  delay(1);  // Adafruit_PN532 pauses 1 ms between I2C transactions

  if (!pollReady(khz, tag, 1000)) {
    resetBus();
    return false;
  }

  // Phase 3: ACK frame — RDY prefix + 6 frame bytes = 7 on the wire.
  uint8_t ack[7] = {0};
  uint8_t n = Wire.requestFrom(kPn532Addr, (uint8_t)7);
  for (uint8_t i = 0; i < n && i < sizeof(ack); ++i) {
    ack[i] = Wire.read();
  }
  Serial.printf("  [proto@%uk %s] ACK read: %u bytes:", khz, tag, n);
  for (uint8_t i = 0; i < n && i < sizeof(ack); ++i) {
    Serial.printf(" %02X", ack[i]);
  }
  Serial.println();
  if (n != 7 || ack[0] != kI2cReady || memcmp(ack + 1, kAckFrame, 6) != 0) {
    Serial.printf("  [proto@%uk %s] ACK frame missing — chip didn't accept the command\n",
                  khz, tag);
    resetBus();
    return false;
  }
  Serial.printf("  [proto@%uk %s] ACK frame OK\n", khz, tag);

  delay(1);
  if (!pollReady(khz, tag, 1000)) {
    resetBus();
    return false;
  }

  // Phase 5: response — RDY prefix + 13-byte frame = 14 on the wire
  // (getFirmwareVersion does readdata(buf, 13), i.e. the same read).
  uint8_t resp[14] = {0};
  n = Wire.requestFrom(kPn532Addr, (uint8_t)14);
  for (uint8_t i = 0; i < n && i < sizeof(resp); ++i) {
    resp[i] = Wire.read();
  }
  Serial.printf("  [proto@%uk %s] response read: %u bytes:", khz, tag, n);
  for (uint8_t i = 0; i < n && i < sizeof(resp); ++i) {
    Serial.printf(" %02X", resp[i]);
  }
  Serial.println();

  // resp[0]=RDY, resp[1..3]=00 00 FF preamble, resp[6]=D5 (TFI),
  // resp[7]=02 (cmd), resp[8..10]=IC type, FW major, FW minor.
  if (n >= 14 && resp[0] == kI2cReady &&
      resp[1] == 0x00 && resp[2] == 0x00 && resp[3] == 0xFF &&
      resp[6] == 0xD5 && resp[7] == 0x02) {
    Serial.printf("  [proto@%uk %s] *** PN532 IC=%02X FW=%u.%u *** PROTOCOL OK\n",
                  khz, tag, resp[8], resp[9], resp[10]);
    Wire.setClock(100000);  // leave the bus at the standard clock
    return true;
  }
  Serial.printf("  [proto@%uk %s] response did not match expected frame\n",
                khz, tag);
  resetBus();
  return false;
}

void scanBus() {
  // Clean driver every cycle — see resetBus().
  resetBus();
  Serial.printf("Scanning I2C bus (SDA=GPIO%d, SCL=GPIO%d)...\n",
                PN532_SDA_PIN, PN532_SCL_PIN);

  // Fresh-bus protocol attempt FIRST — the write lands on an idle
  // bus, exactly like nfcBegin() does at boot, and every phase
  // (ready, ACK, response) is reported separately.
  bool ok = probeProtocol(100000, 100, "fresh");

  if (!ok) {
    // Retry at slower clocks only if the chip still answers its
    // address — a slow clock rescuing a failed phase is the
    // signature of weak pull-ups. A chip that doesn't ACK at all is
    // a wiring/power/mode fault; a slower clock won't conjure it.
    Wire.beginTransmission(kPn532Addr);
    uint8_t addrErr = Wire.endTransmission();
    if (addrErr == 0) {
      ok = probeProtocol(50000, 50, "50k");
      if (!ok) ok = probeProtocol(25000, 25, "25k");
      if (!ok) ok = probeProtocol(10000, 10, "10k");
    } else if (addrErr == 2) {
      Serial.println("  0x24 did not answer at all — wiring/power/DIP switches (see checklist below)");
    } else {
      Serial.printf("  0x24 address check: %s (%d)\n", describeError(addrErr), addrErr);
    }
  }

  // Plain address sweep — who ACKs. Empty addresses stay silent.
  uint8_t found = 0;
  for (uint8_t addr = kFirstAddr; addr <= kLastAddr; ++addr) {
    Wire.beginTransmission(addr);
    uint8_t err = Wire.endTransmission();
    if (err == 0) {
      ++found;
      if (addr == kPn532Addr) {
        Serial.printf("  0x%02X  ACK  <- PN532 (expected address)\n", addr);
      } else {
        Serial.printf("  0x%02X  ACK  <- unknown device\n", addr);
      }
    } else if (err == 5) {
      // Wedged driver would fail every remaining address identically
      // and drown the output — stop here instead.
      Serial.printf("  0x%02X  %s (%d) — stopping sweep\n",
                    addr, describeError(err), err);
      break;
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
    Serial.println("   - Pull-up resistors on SDA/SCL -- many bare PN532");
    Serial.println("     breakouts don't populate them for I2C mode; try");
    Serial.println("     ~4.7k ohm from SDA and SCL to 3V3 if unsure");
  }
  Serial.println();
}

}  // namespace

// Empirical pull-up check, run before Wire claims the pins: drive the
// line low, release it to INPUT (no internal pull-up), and time the
// rise. Only pull-ups physically on the board can pull it back high.
//   <10us         -> external pull-up present (healthy)
//   10us - 3ms    -> weak pull-up / high capacitance (marginal: at
//                    100 kHz a bit lasts 10us, so data bursts and
//                    START edges are the first things to garble)
//   3ms+ / never  -> no pull-up at all: line floats, and a floating
//                    line is exactly what garbles written data bits
//                    while slave-driven low bits still ACK — the
//                    failure mode under test.
void measureRise(int pin, const char* label) {
  // Push-pull HIGH first: if the line can't be driven high at all,
  // it's shorted to GND (wiring fault) — not a pull-up problem.
  pinMode(pin, OUTPUT);
  digitalWrite(pin, HIGH);
  delayMicroseconds(50);
  bool drivableHigh = digitalRead(pin);
  pinMode(pin, OUTPUT_OPEN_DRAIN);
  digitalWrite(pin, LOW);
  delayMicroseconds(200);          // fully discharged
  unsigned long t0 = micros();
  pinMode(pin, INPUT);             // release — no internal pull-up
  while (!digitalRead(pin) && micros() - t0 < 3000) {}
  unsigned long rise = micros() - t0;

  if (!drivableHigh) {
    Serial.printf("[rise] %s: SHORTED TO GND (push-pull high reads 0)\n", label);
    return;
  }
  const char* verdict;
  if (rise >= 3000)      verdict = "NO PULL-UP (floats)";
  else if (rise >= 10)   verdict = "weak pull-up (marginal)";
  else                   verdict = "healthy";
  Serial.printf("[rise] %s: %lu us -> %s\n", label, rise, verdict);
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  measureRise(PN532_SDA_PIN, "SDA");
  measureRise(PN532_SCL_PIN, "SCL");
  Wire.begin(PN532_SDA_PIN, PN532_SCL_PIN);
  Serial.println("\ni2c-scan | NFCPass bus diagnostic");
}

void loop() {
  scanBus();
  delay(2000);
}
