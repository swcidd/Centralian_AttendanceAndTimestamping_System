#!/usr/bin/env python3
"""Encode student data onto a MIFARE Classic 1K card (sectors 1+2's data blocks).

Usage:
    python encode_card.py --school-id 25-1809-52 \
        --first-name "Sherwin Sid" --last-name "Sañol"

Requires: pip install nfcpy
Reader: ACR122U or PN532-based USB reader
"""
import nfc
import json
import sys
import argparse
from binascii import hexlify

DEFAULT_KEY = b"\xff\xff\xff\xff\xff\xff"
# Block 7 (sector 1) and block 11 (sector 2) are each sector's TRAILER
# (Key A + access bits + Key B) on MIFARE Classic — never data, on any
# sector. Writing raw payload bytes into a trailer can corrupt the
# access bits and permanently lock the sector, so this list is
# deliberately just the 6 real data blocks across two sectors, grouped
# by which sector each needs authenticating against.
SECTOR_DATA_BLOCKS = {1: [4, 5, 6], 2: [8, 9, 10]}

def encode(card, data: dict):
    # Build 96-byte payload: JSON + null padding
    payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
    if len(payload) > 96:
        raise ValueError(f"Payload too large: {len(payload)} bytes (max 96)")
    payload = payload.ljust(96, b"\x00")

    # NOTE: this authenticate()/write_block() call shape is carried
    # over from the original single-sector version of this script,
    # which was never actually run against a real card before this
    # bug was caught in review — verify the exact nfcpy API against
    # real hardware before trusting it, same as any first real run.
    block_index = 0
    for sector, blocks in SECTOR_DATA_BLOCKS.items():
        if not card.authenticate(sector, key=DEFAULT_KEY, key_type=nfc.clf.Mifare.KEY_A):
            raise RuntimeError(
                f"Authentication failed on sector {sector} — is the card blank (factory keys)?"
            )
        for block_num in blocks:
            chunk = payload[block_index * 16 : (block_index + 1) * 16]
            card.write_block(block_num, chunk)
            print(f"  Block {block_num}: {chunk}")
            block_index += 1

    print(f"\nEncoded {len(data)} fields ({len(payload.rstrip(b'\\x00'))} bytes JSON)")

def on_connect(tag):
    if tag.type != "MifareClassic":
        print(f"Error: expected MifareClassic, got {tag.type}")
        return False

    uid = hexlify(tag.identifier).decode().upper()
    print(f"Card UID: {uid}")
    print(f"Card type: {tag.product} ({tag._size} bytes)")

    encode(tag, vars(args))
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Encode student data onto MIFARE Classic 1K")
    parser.add_argument("--school-id", required=True)
    parser.add_argument("--first-name", required=True)
    parser.add_argument("--last-name", required=True)
    args = parser.parse_args()

    print("Place card on reader...")
    with nfc.ContactlessFrontend("usb") as clf:
        clf.connect(rdwr={"on-connect": on_connect})
