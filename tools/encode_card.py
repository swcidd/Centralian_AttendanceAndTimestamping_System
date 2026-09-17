#!/usr/bin/env python3
"""Encode student data onto a MIFARE Classic 1K card (sectors 1+2's data blocks).

Usage (CLI):
    python encode_card.py --school-id 25-1809-52 \
        --first-name "Sherwin Sid" --last-name "Sañol"

Usage (library — used by tools/encoder_server.py so the web dashboard
can write cards through a local HTTP bridge):
    from encode_card import encode_student_on_card
    result = encode_student_on_card("25-1809-52", "Sherwin Sid", "Sañol", timeout=60)

Requires: pip install nfcpy
Reader: ACR122U or PN532-based USB reader
"""
import json
import sys
import time
import argparse
from binascii import hexlify

import nfc

DEFAULT_KEY = b"\xff\xff\xff\xff\xff\xff"
# Block 7 (sector 1) and block 11 (sector 2) are each sector's TRAILER
# (Key A + access bits + Key B) on MIFARE Classic — never data, on any
# sector. Writing raw payload bytes into a trailer can corrupt the
# access bits and permanently lock the sector, so this list is
# deliberately just the 6 real data blocks across two sectors, grouped
# by which sector each needs authenticating against.
SECTOR_DATA_BLOCKS = {1: [4, 5, 6], 2: [8, 9, 10]}


class CardEncodeError(Exception):
    """Raised when a card cannot be encoded (reader, auth, or write issue)."""


def build_payload(data: dict) -> bytes:
    """Render student fields as null-padded 96-byte JSON payload."""
    payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
    if len(payload) > 96:
        raise ValueError(
            f"Payload too large: {len(payload)} bytes (max 96). "
            "Shorten school_id / first_name / last_name."
        )
    return payload.ljust(96, b"\x00")


def encode(card, data: dict) -> dict:
    """Write the payload to sectors 1+2 and return what was written."""
    payload = build_payload(data)

    # NOTE: this authenticate()/write_block() call shape is carried
    # over from the original single-sector version of this script,
    # which was never actually run against a real card before this
    # bug was caught in review — verify the exact nfcpy API against
    # real hardware before trusting it, same as any first real run.
    block_index = 0
    for sector, blocks in SECTOR_DATA_BLOCKS.items():
        if not card.authenticate(sector, key=DEFAULT_KEY, key_type=nfc.clf.Mifare.KEY_A):
            raise CardEncodeError(
                f"Authentication failed on sector {sector} — is the card blank (factory keys)?"
            )
        for block_num in blocks:
            chunk = payload[block_index * 16 : (block_index + 1) * 16]
            card.write_block(block_num, chunk)
            block_index += 1

    return {
        "uid": hexlify(card.identifier).decode().upper(),
        "product": getattr(card, "product", "MIFARE Classic 1K"),
        "size": getattr(card, "_size", 1024),
        "bytes_json": len(payload.rstrip(b"\x00")),
    }


def encode_student_on_card(
    school_id: str,
    first_name: str,
    last_name: str,
    timeout: float = 60.0,
) -> dict:
    """Wait for a MIFARE Classic card and write the student's JSON to it.

    Returns a dict like {"uid": ..., "product": ..., "size": ...,
    "school_id": ..., "first_name": ..., "last_name": ...,
    "bytes_json": ...}. Raises CardEncodeError (reader missing, wrong
    card type, auth/read failure, or timeout).
    """
    for label, value in (("school_id", school_id), ("first_name", first_name), ("last_name", last_name)):
        if not value or not str(value).strip():
            raise CardEncodeError(f"Missing required field: {label}")

    data = {"school_id": school_id, "first_name": first_name, "last_name": last_name}
    # Fail fast on payload size before opening the reader.
    build_payload(data)

    result = {}

    def on_connect(tag):
        try:
            if tag.type != "MifareClassic":
                raise CardEncodeError(
                    f"Expected MifareClassic card, got {tag.type}"
                )
            result.update(encode(tag, data))
            result["school_id"] = school_id
            result["first_name"] = first_name
            result["last_name"] = last_name
        except CardEncodeError as exc:
            result["error"] = str(exc)
        return True

    deadline = time.time() + timeout
    terminate = lambda: time.time() > deadline  # noqa: E731

    try:
        with nfc.ContactlessFrontend("usb") as clf:
            clf.connect(rdwr={"on-connect": on_connect, "terminate": terminate})
    except OSError as exc:
        raise CardEncodeError(
            f"No NFC reader found ({exc}). Plug in the ACR122U/PN532 and retry."
        ) from exc

    if "error" in result:
        raise CardEncodeError(result["error"])
    if not result:
        raise CardEncodeError(f"Timed out waiting for a card ({timeout:.0f}s).")

    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Encode student data onto MIFARE Classic 1K")
    parser.add_argument("--school-id", required=True)
    parser.add_argument("--first-name", required=True)
    parser.add_argument("--last-name", required=True)
    parser.add_argument("--timeout", type=float, default=60.0, help="seconds to wait for a card")
    args = parser.parse_args()

    print("Place card on reader...")
    try:
        info = encode_student_on_card(
            args.school_id, args.first_name, args.last_name, timeout=args.timeout
        )
    except CardEncodeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"Card UID: {info['uid']}")
    print(f"Card type: {info['product']} ({info['size']} bytes)")
    print(
        f"Encoded {info['first_name']} {info['last_name']} "
        f"({info['school_id']}) — {info['bytes_json']} bytes JSON"
    )