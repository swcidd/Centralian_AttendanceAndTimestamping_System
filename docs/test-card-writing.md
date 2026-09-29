# Testing Card Writing — Step-by-Step Guide

How to encode student data onto a MIFARE Classic 1K card and verify the write
was successful. Covers both the web dashboard (`/encode`) and the CLI
(`tools/encode_card.py`).

## Prerequisites

| What | Why |
|---|---|
| ACR122U or PN532-based **USB NFC reader** | Writes to MIFARE Classic cards |
| Blank **MIFARE Classic 1K** cards | Factory-default keys required |
| Python 3.10+ with `nfcpy` installed | `nfcpy` is the card I/O library |
| The CATS repo checked out locally | Contains `tools/encode_card.py` and `tools/encoder_server.py` |

### One-time setup

```bash
cd /path/to/Centralian_AttendanceAndTimestamping_System
python3 -m venv .venv                     # skip if .venv already exists
.venv/bin/pip install nfcpy               # pip, NOT pipx (nfcpy is a library)
```

Verify the reader is detected:

```bash
.venv/bin/python -c "
import nfc
try:
    clf = nfc.ContactlessFrontend('usb')
    print('Reader OK:', bool(clf))
    if clf: clf.close()
except OSError as e:
    print('No reader:', e)
```

If "No reader" appears: plug in the reader, check `lsusb` for the device,
and ensure your user has USB permissions (Linux: udev rule or `sudo`).

---

## Method 1 — Web Dashboard (recommended)

This uses the `/encode` page which talks to the local encoder bridge.

### Step 1: Start the encoder bridge

```bash
.venv/bin/python tools/encoder_server.py
# Listening on http://127.0.0.1:8787
```

### Step 2: Verify the bridge is healthy

```bash
curl -s http://127.0.0.1:8787/health
```

Expected with reader plugged in:

```json
{"ok": true, "nfcpy": true, "reader": true}
```

If `"reader": false`, the reader isn't detected — check `lsusb` and udev.

### Step 3: Open the Encode Card page

| Environment | URL |
|---|---|
| Local dev server (`npm run dev`) | `http://localhost:5173/encode` |
| Cloudflare staging preview | `https://staging.<your-project>.pages.dev/encode` |

The green dot next to "Local encoder connected" confirms the page can reach
your bridge. If the dot is red, the bridge isn't running or is on a different
port (check `VITE_ENCODER_URL` in `.env`).

### Step 4: Fill in student details

| Field | Example | Max length |
|---|---|---|
| School ID | `25-1809-52` | ~20 chars |
| First Name | `Christopher Jonathan` | ~40 chars |
| Last Name | `Santos-Delgado` | ~40 chars |

The live counter shows `N/336 bytes`. The JSON key overhead is 47 bytes, so
you have **289 bytes** of value budget. If the counter turns red, shorten a
name.

### Step 5: Write to the card

1. Place a **blank** MIFARE Classic card on the reader.
2. Click **Write to card**.
3. The page shows *"Waiting for a card — tap it on the reader now..."*.
4. If the card is already on the reader, the write starts immediately.
5. On success: the card UID is displayed (e.g. `UID 04A1B2C3D4E5F6G7`).
6. Click **Encode another** to repeat.

### Step 6: Verify the write (read-back test)

Encode the card, then read it back to confirm the JSON is correct:

```bash
# Start a Python session with the venv
.venv/bin/python
```

```python
import nfc
from binascii import hexlify

with nfc.ContactlessFrontend("usb") as clf:
    tag = clf.connect(rdwr={"on-connect": lambda tag: True})
    blocks = []
    # Read blocks 4-30 (sectors 1-7, skipping trailers 7/11/15/19/23/27/31)
    for block in [4,5,6, 8,9,10, 12,13,14, 16,17,18, 20,21,22, 24,25,26, 28,29,30]:
        data = tag.read(block)
        blocks.append(data)
    raw = b"".join(blocks)
    # Trim at first null byte
    json_str = raw.split(b"\x00", 1)[0].decode("utf-8")
    print("UID:", hexlify(tag.identifier).decode().upper())
    print("JSON:", json_str)
```

Expected output for the example above:

```
UID: 04A1B2C3D4E5F6G7
JSON: {"school_id":"25-1809-52","first_name":"Christopher Jonathan","last_name":"Santos-Delgado"}
```

If the JSON is garbled or empty, the card may have been written with an
older layout — re-encode it.

---

## Method 2 — CLI (standalone, no browser)

```bash
.venv/bin/python tools/encode_card.py \
    --school-id 25-1809-52 \
    --first-name "Christopher Jonathan" \
    --last-name "Santos-Delgado" \
    --timeout 60
```

Expected output:

```
Place card on reader...
Card UID: 04A1B2C3D4E5F6G7
Card type: MIFARE Classic 1K (1024 bytes)
Encoded Christopher Jonathan Santos-Delgado (25-1809-52) — 102 bytes JSON
```

The "102 bytes JSON" confirms the payload was written (padded to 336 bytes
on the card). Use the read-back script from Method 1 Step 6 to verify.

---

## Method 3 — Bulk encoding from a roster

Given a JSON array of students:

```json
[
  {"school_id": "25-1809-52", "first_name": "Christopher Jonathan", "last_name": "Santos-Delgado"},
  {"school_id": "25-1809-53", "first_name": "Jane", "last_name": "Doe"}
]
```

```bash
for student in $(jq -c '.[]' roster.json); do
    .venv/bin/python tools/encode_card.py \
        --school-id "$(echo "$student" | jq -r '.school_id')" \
        --first-name "$(echo "$student" | jq -r '.first_name')" \
        --last-name "$(echo "$student" | jq -r '.last_name')"
done
```

The script blocks on `Place card on reader...` for each student, so swap
cards between iterations.

---

## Verifying on the ESP32 terminal (end-to-end)

Once a card is encoded, test the full attendance pipeline:

1. Flash the ESP32 with the current firmware (`pio run -e esp32-s3-n16r8 -t upload`).
2. Open the serial monitor (`pio device monitor` or `pio run -e esp32-s3-n16r8 -f send_on_enter`).
3. Tap the encoded card on the PN532 terminal.
4. The serial output should show:
   ```
   [nfcReadData] Card detected: 04A1B2C3D4E5F6G7 — attempting sector read...
   [nfcReadData] Auth OK with Key A: FFFFFFFFFFFF
   [nfcReadData] All 21 blocks read OK
   Card raw (102 bytes): {"school_id":"25-1809-52","first_name":"Christopher Jonathan","last_name":"Santos-Delgado"}
   Parsed JSON: school_id=25-1809-52 name=Christopher Jonathan Santos-Delgado
   ```

If the firmware shows `NO DATA — card has no JSON written to sectors 1-7`,
the card wasn't encoded with the current 7-sector layout — re-encode it.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Red dot on `/encode` page | Bridge not running | Start `.venv/bin/python tools/encoder_server.py` |
| `{"reader": false}` at `/health` | Reader not plugged in or no USB perms | Check `lsusb`; on Linux add a udev rule or run with `sudo` |
| `Error: Authentication failed on sector N` | Card has non-default keys | Use a blank card; or re-encode same card (layout keeps default keys) |
| `Error: Expected MifareClassic, got ...` | Wrong card type (Ultralight/NTAG) | Use MIFARE Classic 1K cards only |
| `Payload too large: N bytes (max 336)` | Name too long | Shorten first/last name fields |
| JSON garbled on firmware read-back | Card encoded with old 96-byte layout | Re-encode with current `tools/encode_card.py` |
| `nfcpy is not installed` from bridge | Bridge running outside venv | Kill server; restart with `.venv/bin/python tools/encoder_server.py` |
| `No NFC reader found` | Reader not detected by nfcpy | Check `lsusb`; ensure `libusb-1.0` installed; try `sudo` |

---

## Card format reference

| Property | Value |
|---|---|
| Card type | MIFARE Classic 1K |
| Sectors used | 1–7 (21 data blocks) |
| Total payload | 336 bytes (21 × 16) |
| JSON key overhead | 47 bytes |
| Usable for values | ~289 bytes |
| Trailer blocks (never written) | 7, 11, 15, 19, 23, 27, 31 |
| Authentication | Key A = `0xFFFFFFFFFFFF` (factory default) per sector |
| Encoding | UTF-8 JSON, null-padded to 336 bytes |
| JSON keys | `school_id`, `first_name`, `last_name` |
