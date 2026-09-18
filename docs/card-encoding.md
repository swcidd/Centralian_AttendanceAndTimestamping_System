# Card Encoding Guide

How to write student data onto blank MIFARE Classic 1K cards for registration mode, using the standalone `tools/encode_card.py` script. This is decoupled from the ESP32/dashboard system — it runs on a desktop with a USB NFC reader, before a card is ever tapped on a terminal.

See [`docs/registration-mode-handoff.md`](registration-mode-handoff.md) for how the firmware/backend consume the data this script writes.

## Card Format

Student data (`school_id`, `first_name`, `last_name`) is stored as a JSON object, null-padded, across **21 data blocks spanning seven sectors**:

| Sector | Data blocks | Trailer (never written) |
|---|---|---|
| 1 | 4, 5, 6 | 7 |
| 2 | 8, 9, 10 | 11 |
| 3 | 12, 13, 14 | 15 |
| 4 | 16, 17, 18 | 19 |
| 5 | 20, 21, 22 | 23 |
| 6 | 24, 25, 26 | 27 |
| 7 | 28, 29, 30 | 31 |

That's 21 × 16 = **336 bytes** of usable payload, authenticated per-sector with the default factory key `0xFFFFFFFFFFFF` (Key A). The JSON key overhead is 47 bytes, leaving **289 bytes** for student data values — comfortably enough for long double-barrelled names.

```json
{"school_id":"25-1809-52","first_name":"Sherwin Sid","last_name":"Sañol"}
```

Block layout: blocks 4–6 (sector 1) = bytes 0–47, blocks 8–10 (sector 2) = 48–95, blocks 12–14 (sector 3) = 96–143, blocks 16–18 (sector 4) = 144–191, blocks 20–22 (sector 5) = 192–239, blocks 24–26 (sector 6) = 240–287, blocks 28–30 (sector 7) = 288–335.

**Why blocks 7, 11, 15, 19, 23, 27, and 31 are skipped — do not add them back.** On every MIFARE Classic sector, the last of its 4 blocks (block `4N+3`) is the **sector trailer**: Key A, access bits, and Key B, not general storage. This isn't specific to this card or this project — it's true of any MIFARE Classic card. Writing a JSON payload into a trailer overwrites the keys and access bits, which can **permanently lock the sector**. Each sector therefore has only 3 usable data blocks (48 bytes), so seven sectors are needed for a 336-byte payload.

Requirements for a card to accept encoding:
- MIFARE Classic 1K (not Ultralight, NTAG, or DESFire — those don't have this sector/key structure)
- Blank / factory-default keys, or already encoded with this exact layout
- All seven sectors (1–7) must authenticate with Key A = `0xFFFFFFFFFFFF`

## Required Hardware

- A desktop/laptop with a free USB port
- An **ACR122U** USB NFC reader, or any PN532-based USB reader `nfcpy` supports
- Blank MIFARE Classic 1K cards (factory default keys)

The ESP32/PN532 terminal is not involved in encoding — this is a separate, offline provisioning step.

## Python Setup

```bash
pip install nfcpy
```

On Linux, `nfcpy` talks to most USB readers via `pyusb`/`libusb`; if the reader isn't detected, you may need udev rules granting your user access to the device (see the [nfcpy documentation](https://nfcpy.readthedocs.io/) for reader-specific setup) or to run with elevated permissions. On macOS/Windows, the ACR122U typically works through its PC/SC driver instead.

## Single-Card Encoding

```bash
python tools/encode_card.py \
    --school-id 25-1809-52 \
    --first-name "Sherwin Sid" \
    --last-name "Sañol"
```

The script prints `Place card on reader...` and waits. Tap a blank card; it authenticates each of sectors 1–7 in turn, writes 3 blocks per sector, then prints a confirmation with the card UID and payload size.

> **Unverified API note:** the `card.authenticate()` / `card.write_block()` calls in `tools/encode_card.py` are written against the expected shape of `nfcpy`'s tag API but have not been run against real `nfcpy` or real hardware yet. Before trusting this against a batch of cards, do a single test encode-then-read-back cycle and confirm against the actual `nfcpy` docs/source if anything doesn't match — same caution you'd apply to any library call that hasn't been exercised for real.

## Bulk Encoding from a Roster

Given a JSON array of students:

```json
[
  {"school_id": "25-1809-52", "first_name": "Sherwin Sid", "last_name": "Sañol"},
  {"school_id": "25-1809-53", "first_name": "Jane", "last_name": "Doe"}
]
```

Loop over it with `jq` (`apt install jq` / `brew install jq` if not already present), encoding one card per iteration:

```bash
for student in $(jq -c '.[]' roster.json); do
    python tools/encode_card.py \
        --school-id "$(echo "$student" | jq -r '.school_id')" \
        --first-name "$(echo "$student" | jq -r '.first_name')" \
        --last-name "$(echo "$student" | jq -r '.last_name')"
done
```

The script blocks on `Place card on reader...` for each iteration, so this walks you through the roster one physical card at a time rather than requiring all cards up front.

## Troubleshooting

**`RuntimeError: Authentication failed on sector N`**
The most common cause is a card that isn't blank — either it already has a real student encoded (re-running the script on the same card should still work, since the layout keeps default keys; this only fails if the card's keys were changed to something non-default) or it's a used card from a different system that changed sector 1/2's keys. Confirm the card is fresh from a blank pack. If a card was accidentally left in a non-default-key state by a prior mistake, standard key recovery tools (e.g. `mfoc`) may recover it if the keys are weak/known, but the reliable fix is to use a fresh card — don't rely on cracking your own cards back into a usable state as the normal workflow. If *every* card fails, double check the reader has a card seated and check `nfcpy`'s connection log — this can also mean the API-shape caveat above is the real problem, not the card.

**`Error: expected MifareClassic, got <other type>`**
The tapped card isn't MIFARE Classic — commonly a MIFARE Ultralight/NTAG card (no sector/key structure at all) or a different vendor's card shipped in the same batch. Check the card packaging/datasheet; Ultralight and Classic cards can look identical.

**`ValueError: Payload too large: N bytes (max 336)`**
The JSON payload exceeds the 336-byte budget — extremely unlikely with normal names. There's no truncation built in on purpose (silently cutting a name is worse than failing loudly); shorten the name fields if this comes up.

**Card reads back empty or as garbled JSON on the firmware side**
Usually means the card was encoded with an older layout (sectors 1–2 only) or by a modified script that changed the block list. The firmware's `nfcReadData()` (`firmware/src/nfc.cpp`) reads blocks `{4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18, 20, 21, 22, 24, 25, 26, 28, 29, 30}`. Re-encode the card with the current `tools/encode_card.py`.
