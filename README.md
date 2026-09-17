# CATS — Centralian Attendance & Timestamping System

An NFC-based university attendance system. Students tap a MIFARE Classic card on a wall-mounted ESP32-S3 + PN532 terminal; the firmware signs the tap and posts it to a Supabase backend, which records the student in an `attendance_logs` row for the currently-active session. A React + Vite dashboard (deployed to Cloudflare Pages) lets instructors manage courses, open/close attendance sessions, and watch the live roster update in real time.

## Architecture

```
┌──────────────┐  tap    ┌───────────────────────┐   HTTP (HMAC)   ┌─────────────────────┐
│ MIFARE card  │ ──────▶ │ ESP32-S3 + PN532       │ ──────────────▶ │ Supabase Edge Funcs  │
│ (JSON payload│         │ terminal firmware      │                 │  ingest-tap          │
│  + NFC UID)  │         │ (PlatformIO / Arduino) │                 │  poll-commands       │
└──────────────┘         └───────────────────────┘                 └──────────┬──────────┘
                                                                              │
                                                              ┌───────────────▼──────────────┐
                                                              │ Supabase Postgres + Realtime │
                                                              │ (auth, RLS, tables)          │
                                                              └───────────────┬──────────────┘
                                                                              │
                                              ┌───────────────────────────────▼───────────────┐
                                              │ React + Vite dashboard (Cloudflare Pages)     │
                                              │  Auth, course mgmt, live attendance tracking │
                                              └───────────────────────────────────────────────┘
```

Three loosely-coupled pieces:

1. **Firmware** (`firmware/`) — PlatformIO Arduino project for the ESP32-S3 terminal. Reads the student JSON off MIFARE Classic cards, validates the UID, signs taps with a pre-shared key, and POSTs them to `ingest-tap`. Can also poll `poll-commands` for session state.
2. **Backend** (`supabase/`) — Supabase Postgres schema (RLS-protected) plus two Edge Functions, `ingest-tap` and `poll-commands`, authenticated by an HMAC-SHA256 pre-shared key.
3. **Dashboard** (`src/`) — React + Vite + TypeScript + Tailwind app (Snowpack/`cpu-cats`) deployed to Cloudflare Pages.

## Repository Layout

```
├── firmware/            # ESP32-S3 terminal firmware (PlatformIO)
│   ├── include/         #   config.h (gitignored), config.h.example, pins.h
│   └── src/             #   main.cpp, nfc.cpp, net.cpp, led.cpp, commands.cpp, ...
├── supabase/
│   ├── functions/       #   Edge Functions (ingest-tap, poll-commands, _shared)
│   └── migrations/      #   SQL schema (0001-0011, snake_case)
├── src/                 # React + Vite dashboard
├── tools/               # standalone card-encoding scripts
├── docs/                # project planning & card-encoding docs
├── wrangler.jsonc       # Cloudflare Pages config
└── package.json         # dashboard scripts/deps
```

## Prerequisites

- **Dashboard:** Node.js 20+, npm
- **Firmware:** PlatformIO CLI (binary `~/.platformio/penv/bin/pio`) or the PlatformIO IDE extension
- **Backend:** A Supabase project, the Supabase CLI (`supabase`), Access Token, and Project Ref

## Getting Started

### 1. Dashboard

Install deps, configure environment, and run the dev server.

```bash
npm install
cp .env.example .env   # set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Other scripts:

```bash
npm run build     # type-check (tsc -b) + production build into dist/
npm run lint      # ESLint
npm run preview   # preview the production build
```

The dashboard picks up realtime attendance via Supabase channels, so an open session on a terminal reflects live taps without a page refresh. Deploy the `dist/` output to Cloudflare Pages (see `wrangler.jsonc` for the SPA asset config).

### 2. Backend (Supabase)

Apply migrations and deploy the Edge Functions.

```bash
# migrations (0001-0011) define the snake_case schema + RLS
supabase db push --project-ref <project-ref>

# deploy Edge Functions without JWT gate (device taps use PSK, not user auth)
supabase functions deploy ingest-tap --project-ref <project-ref> --no-verify-jwt
supabase functions deploy poll-commands --project-ref <project-ref> --no-verify-jwt

# store the device pre-shared key as a secret
supabase secrets set DEVICE_PSK=<shared-secret> --project-ref <project-ref>
```

> The Edge Functions verify an HMAC-SHA256 signature computed from the device MAC + timestamp (+ NFC UID for taps) using `DEVICE_PSK`. This key must match the one compiled into firmware (`config.h`).

### 3. Firmware

Configure secrets, then build/flash.

```bash
cp firmware/include/config.h.example firmware/include/config.h
# edit config.h: WIFI_SSID, WIFI_PASSWORD, DEVICE_PSK, API_ENDPOINT_URL, POLL_COMMANDS_ENDPOINT_URL

~/.platformio/penv/bin/pio run -e esp32-s3-n16r8 -t upload
~/.platformio/penv/bin/pio device monitor -e esp32-s3-n16r8 -f send_on_enter
```

**PlatformIO environments** (`firmware/platformio.ini`):

| Env | Entry point | Purpose |
|---|---|---|
| `esp32-s3-n16r8` | `main.cpp` | Production firmware (real HTTP POST) |
| `net-test` | `net_dry.cpp` | Dry-run of the network path (prints payload, no HTTP) |
| `nfc-test` | `nfc_test_main.cpp` | NFC/UID read-only test |
| `i2c-scan` | `i2c_scan_main.cpp` | Scan the I2C bus for the PN532 |

> **config.h is gitignored** — each developer/device keeps a private copy. Only `config.h.example` is committed.

## Card Encoding

Student cards are provisioned **before** they're ever tapped on a terminal, using `tools/encode_card.py` on a desktop with a USB NFC reader (ACR122U or PN532). It writes raw JSON (school_id, first_name, last_name), null-padded, across MIFARE Classic 1K sectors 1 & 2 (blocks 4–6, 8–10) with the factory-default key.

See **[`docs/card-encoding.md`](docs/card-encoding.md)** for the full layout, hardware requirements, and single/bulk encoding instructions.

```bash
pip install nfcpy
python tools/encode_card.py --school-id 25-1809-52 --first-name "Doe" --last-name "Jane"
```

The firmware's `nfcReadData()` authenticates with a multi-key probe and scans for `{` to extract the JSON, so both raw and NDEF-wrapped payloads are handled.

## How a Tap Flows

1. Student taps a card on the terminal.
2. `nfcReadData()` reads the student JSON + UID from the card.
3. The firmware signs `MAC + Timestamp + NFC_UID` with `DEVICE_PSK` (HMAC-SHA256).
4. It POSTs the signed payload to `ingest-tap`.
5. The Edge Function verifies the signature, looks up the active session for the device, finds/creates the student, and inserts an `attendance_logs` row.
6. The dashboard's realtime subscription updates the roster.

## Documentation

- [`docs/project-plan.md`](docs/project-plan.md) — original project planning
- [`docs/handoff.md`](docs/handoff.md) — engineering handoff
- [`docs/card-encoding.md`](docs/card-encoding.md) — card provisioning spec
- [`docs/registration-mode-handoff.md`](docs/registration-mode-handoff.md) — registration mode details

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for branch conventions, how to run tests/lint, and development workflows.
