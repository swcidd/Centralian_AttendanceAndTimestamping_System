# Card Encoder Bridge — Web Dashboard → MIFARE Cards

The dashboard's **Encode Card** page (`/encode`) writes student JSON onto
MIFARE Classic 1K cards through a **local HTTP bridge** running on the
computer with the USB NFC reader. It is intentionally decoupled from the
Supabase backend: the bridge is a loopback tool, so encoding works
**whether you are signed in or out**.

```
Browser (/encode page)
   │  fetch http://localhost:8787/encode  (student JSON)
   ▼
tools/encoder_server.py  (Python stdlib HTTP server)
   │  calls tools/encode_card.py::encode_student_on_card()
   ▼
nfcpy → ACR122U / PN532 USB reader → MIFARE card
```

## How it works

1. **The page is public** — route `/encode` sits outside the auth-guarded
   dashboard layout. Signed-in users also get a nav link in the sidebar;
   signed-out users reach it from a link on the login page.
2. **Server availability check** — on load the page calls
   `GET /health`. If the local server isn't running, a banner shows the
   exact command to start it.
3. **Write** — the form (school ID, first name, last name) validates the
   payload stays ≤ 96 bytes (card capacity for sectors 1+2), then
   `POST /encode`. The server blocks until a card is tapped, writes the
   JSON, and returns the card UID. The page shows a "waiting for card"
   state and the final UID.

## Running the bridge

```bash
pip install nfcpy          # only dependency
python3 tools/encoder_server.py          # http://127.0.0.1:8787
ENCODER_PORT=9000 python3 tools/encoder_server.py   # custom port
```

The dashboard targets `http://localhost:8787` by default. Point it
elsewhere with the `VITE_ENCODER_URL` env var (see `.env.example`) and
match `ENCODER_PORT` when starting the server.

## Endpoints

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/health` | — | `{"ok":true,"nfcpy":<bool>,"reader":<bool>}` — `reader` is true when an NFC reader is present |
| `POST` | `/encode` | `{"school_id","first_name","last_name","timeout"?}` | `{"ok":true,"uid","product","size","bytes_json",...}` or `{"ok":false,"error"}` |
| `OPTIONS` | `/encode` | — | CORS preflight (required because the dashboard origin differs) |

Errors map to HTTP status: `400` bad body/missing fields, `409`
card/auth/timeout failure, `503` nfcpy missing.

## Troubleshooting

- **"Local encoder not reachable"** — start the server; confirm nothing
  else holds port 8787 (`ss -tlnp | grep 8787` or netstat).
- **"nfcpy is not installed"** — `pip install nfcpy`, restart the server.
- **"No NFC reader found"** — plug in the ACR122U/PN532-based reader and
  re-tap; `/health` should show `"reader": true`.
- **"Payload too large"** — keep school ID + names short; the firmware
  reads a fixed 96-byte sector payload.
- **Auth/timeout** — card must be blank (factory keys) or already encoded
  with this layout; see `docs/card-encoding.md` for the block/format spec.

## Security note

The bridge binds to `127.0.0.1` only and grants no access to Supabase —
its sole capability is writing the card on the local reader. Do not
expose it beyond the machine that owns the NFC reader (no port
forwarding); a hostile web page could otherwise misuse it to overwrite
cards.