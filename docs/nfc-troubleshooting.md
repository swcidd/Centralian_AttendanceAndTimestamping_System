# NFC Troubleshooting — PN532 wiring & diagnostics

How the reader is wired, how to test it, and how to read every line the
diagnostics print.

## Wiring (ESP32-S3 ↔ PN532)

| PN532 pin | ESP32-S3 | Notes |
|---|---|---|
| VCC | `3V3` | 3.3 V only — never 5 V |
| GND | `GND` | Shared ground |
| SDA | **GPIO 8** | `PN532_SDA_PIN` in `firmware/include/pins.h` |
| SCL | **GPIO 9** | `PN532_SCL_PIN` in `firmware/include/pins.h` |
| IRQ | *not connected* | Firmware polls; constructed as `Adafruit_PN532(-1, -1)` |
| RST / RSTO | *not connected* | Never wire RST to a GPIO |

- **DIP switches: SW1 = ON, SW2 = OFF** → I²C mode. (SPI would be the
  reverse; UART/HSU is SW1=OFF, SW2=OFF.)
- GPIO **8/9** are the ESP32-*S3*'s default `Wire` pins. GPIO 21/22 are the
  *classic* ESP32's — they belong to a different chip.
- **Pull-ups:** many bare PN532 breakouts don't populate them. If the bus
  misbehaves, add **4.7 kΩ from SDA→3V3 and SCL→3V3**. `i2c-scan` measures
  this (see below).

## The two test firmwares

```bash
cd firmware

# Decisive smoke test — the real Adafruit handshake + tap-to-read
~/.platformio/penv/bin/pio run -e nfc-test -t upload -t monitor

# Bare-bus diagnostic — what's actually on the wire, no library
~/.platformio/penv/bin/pio run -e i2c-scan -t upload -t monitor
```

- **`nfc-test`** is the pass/fail: `PN532 found. Tap a card...` (then `UID: …`
  on tap) means the reader works end to end. `PN532 not found - check I2C
  wiring and DIP switches (SW1=ON, SW2=OFF)` means fall through to the fault
  table below.
- **`i2c-scan`** says *why* — rise times, each protocol phase, and an address
  sweep, without the Adafruit library in the way.

## Reading `i2c-scan`

A healthy cycle:

```
[rise] SDA: 3 us -> healthy
[rise] SCL: 3 us -> healthy

i2c-scan | NFCPass bus diagnostic
Scanning I2C bus (SDA=GPIO8, SCL=GPIO9)...
  [proto@100k fresh] write GET_FIRMWARE_VERSION frame...
  [proto@100k fresh] wrote 9/9 bytes, endTransmission=0 (OK)
  [proto@100k fresh] READY after 0 polls
  [proto@100k fresh] ACK read: 7 bytes: 01 00 00 FF 00 FF 00
  [proto@100k fresh] ACK frame OK
  [proto@100k fresh] response read: 14 bytes: 01 00 00 FF 06 FA D5 02 03 01 02 05 1E 00
  [proto@100k fresh] *** PN532 IC=03 FW=1.2 *** PROTOCOL OK
  0x24  ACK  <- PN532 (expected address)
```

`PROTOCOL OK` + `0x24 ACK` and nothing else = fully healthy (empty addresses
stay silent).

### Pull-up verdicts (`[rise]` lines)

Measured at boot by discharging each line and timing the rise with **no**
internal pull-up — only physical board pull-ups can pull it back high.

| Verdict | Meaning |
|---|---|
| `< 10 us → healthy` | External pull-ups present |
| `10 us – 3 ms → weak pull-up (marginal)` | High resistance/capacitance: at 100 kHz a bit lasts 10 µs, so data bursts are the first to garble. Add 4.7 kΩ. |
| `≥ 3 ms → NO PULL-UP (floats)` | No pull-ups at all — writes will fail while ACKs still squeak by. Add 4.7 kΩ. |
| `SHORTED TO GND` | Wiring fault — SDA/SCL touching GND |

### Protocol phases (the `[proto@…]` lines)

The PN532 I²C conversation (mirrors `Adafruit_PN532` exactly) — every read is
prefixed by a **RDY byte (`0x01`)**, and the chip speaks in two frames:

1. write command → 2. poll RDY → **3. read the 6-byte ACK frame** →
4. poll RDY again → **5. read the response frame**

| Failing line | Means |
|---|---|
| `write … endTransmission=2` | Chip didn't hear the command (absent/NACK) — wiring, power, or DIP switches |
| `write … TIMEOUT — bus wedged` | SDA/SCL physically stuck — power-cycle; check for shorts/pull-ups |
| `never became ready` | Chip heard the command but never processed it — power issue or chip held in a bad mode (power-cycle; check DIP switches) |
| `ACK frame missing` | Command reached the chip but was rejected — often signal integrity (try the slower-clock tiers, add pull-ups) |
| `response did not match expected frame` | Chip is answering but the bytes are garbled — signal integrity: pull-ups / breadboard contacts / try slower clock tiers (the `50k/25k/10k` attempts that follow a failure) |

On any failure the scan re-creates the I²C driver (`Wire.end()/begin()`) so
one bad probe can no longer poison the rest of the cycle.

### Error codes in the address sweep

| Code | Meaning |
|---|---|
| `0` | ACK — someone is there (0x24 = PN532) |
| 2 | NACK on address — nobody home. Normal for empty addresses |
| 3 / 4 | NACK on data / bus error — bus-level problem |
| `5` / `Error 263` | Driver timeout (bus wedged). The sweep stops at the first one instead of printing one line per address |

### History: the pre-fix scanner bug

The first version of this diagnostic did **one oversized read** right after
the first READY — landing on the ACK frame instead of the response. That
over-read wedged the chip/bus, which then showed up as cascading
`Error 263` / `endTransmission=5` failures and a fake trail of "devices"
from 0x25 upward. The rule that fixed it: **read the ACK frame first, then
poll RDY again, then read the response — and re-init the driver on any
failure.** If you ever see the old signature again, power-cycle and reflash
the current `i2c-scan`.

## Fault decision tree

| Symptom | Go to |
|---|---|
| No `0x24`, checklist printed | Wiring: SDA→GPIO8, SCL→GPIO9, VCC→3V3, shared GND, DIP SW1=ON/SW2=OFF, pull-ups |
| Rise verdicts marginal/none | 4.7 kΩ pull-ups SDA/SCL → 3V3; reseat jumpers |
| `0x24 ACK` but a `[proto]` phase fails | Phase table above; watch whether the slower-clock tiers rescue it (= pull-ups) |
| Everything times out (`wedged`, `Error 263`) | Power-cycle the board; then check SDA/SCL for shorts to GND or each other |
| `i2c-scan` fully healthy but `nfc-test` says not found | Reflash `i2c-scan` once to confirm, then check that production boots **NFC before WiFi** (WiFi RF noise on the 3V3 rail — fixed in `fix(firmware): resolve WiFi+I2C power conflict; init NFC before WiFi`) |
| Intermittent found/not-found | Loose breadboard contact — the original culprit in this project. Press every jumper down / reseat |

## Related

- Card encoding: [`docs/test-card-writing.md`](test-card-writing.md)
- Firmware env table: [`README.md`](../README.md)
