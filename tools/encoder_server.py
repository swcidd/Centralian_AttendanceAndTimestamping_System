#!/usr/bin/env python3
"""Local HTTP bridge: lets the web dashboard write MIFARE student cards.

The dashboard's /encode page POSTs student data here; this server waits
for a card on the USB NFC reader and writes the JSON via
tools/encode_card.py. Works without login because it never touches the
Supabase backend — it is a purely local loopback tool.

Run:
    python3 tools/encoder_server.py               # http://127.0.0.1:8787
    ENCODER_PORT=9000 python3 tools/encoder_server.py

Endpoints:
    GET  /health   -> {"ok": true, "nfcpy": true, "reader": false, ...}
    POST /encode   -> {"ok": true, "uid": ..., "school_id": ..., ...}
                   |  {"ok": false, "error": "..."}
    OPTIONS /encode -> CORS preflight (Access-Control-Allow-Origin: *)

Only install dependency: nfcpy (pip install nfcpy) for the reader.
"""
import os
import json
import importlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = os.environ.get("ENCODER_HOST", "127.0.0.1")
PORT = int(os.environ.get("ENCODER_PORT", "8787"))

DEFAULT_TIMEOUT_S = 60.0
MAX_TIMEOUT_S = 300.0
MIN_TIMEOUT_S = 5.0


def reader_status() -> dict:
    """Describe the local encoder environment without touching a card."""
    status = {"ok": True, "nfcpy": False, "reader": False}
    try:
        importlib.import_module("encode_card")  # import tools/encode_card.py
        status["nfcpy"] = True
        import nfc

        try:
            with nfc.ContactlessFrontend("usb") as clf:
                status["reader"] = bool(clf)
        except OSError:
            status["reader"] = False
    except ImportError:
        pass
    return status


class EncoderHandler(BaseHTTPRequestHandler):
    server_version = "CATSEncoder/1.0"

    # ---- CORS: the dashboard may live on any origin (local or Pages). ----
    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")

    def _send_json(self, status: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path.rstrip("/") == "/health":
            self._send_json(200, reader_status())
        else:
            self._send_json(404, {"ok": False, "error": f"Unknown endpoint: {self.path}"})

    def do_POST(self):
        if self.path.rstrip("/") != "/encode":
            self._send_json(404, {"ok": False, "error": f"Unknown endpoint: {self.path}"})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b"{}"
            body = json.loads(raw.decode("utf-8")) if raw else {}
        except (ValueError, json.JSONDecodeError) as exc:
            self._send_json(400, {"ok": False, "error": f"Invalid JSON body: {exc}"})
            return

        school_id = str(body.get("school_id", "")).strip()
        first_name = str(body.get("first_name", "")).strip()
        last_name = str(body.get("last_name", "")).strip()

        missing = [k for k, v in (("school_id", school_id), ("first_name", first_name), ("last_name", last_name)) if not v]
        if missing:
            self._send_json(400, {"ok": False, "error": f"Missing field(s): {', '.join(missing)}"})
            return

        try:
            timeout = float(body.get("timeout", DEFAULT_TIMEOUT_S))
        except (TypeError, ValueError):
            timeout = DEFAULT_TIMEOUT_S
        timeout = max(MIN_TIMEOUT_S, min(timeout, MAX_TIMEOUT_S))

        try:
            encode_card = importlib.import_module("encode_card")
        except ImportError:
            self._send_json(503, {
                "ok": False,
                "error": "nfcpy is not installed. Run: pip install nfcpy",
            })
            return

        try:
            info = encode_card.encode_student_on_card(
                school_id, first_name, last_name, timeout=timeout
            )
        except encode_card.CardEncodeError as exc:
            self._send_json(409, {"ok": False, "error": str(exc)})
            return

        self._send_json(200, {"ok": True, **info})


def main():
    print(f"CATS card encoder listening on http://{HOST}:{PORT}")
    print("  GET  /health   — encoder + reader status")
    print("  POST /encode   — write student data to the next tapped card")
    print("Press Ctrl+C to stop.")
    ThreadingHTTPServer((HOST, PORT), EncoderHandler).serve_forever()


if __name__ == "__main__":
    main()