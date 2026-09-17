# Contributing

Thanks for helping with **CATS — Centralian Attendance & Timestamping System**. This guide covers conventions for the whole repo (firmware, backend, and dashboard).

## Development Setup

See [`README.md`](README.md#getting-started) for environment-specific setup:

- **Dashboard:** `npm install`, copy `.env.example` → `.env`, `npm run dev`
- **Firmware:** copy `firmware/include/config.h.example` → `firmware/include/config.h` (gitignored) and fill in real values before building
- **Backend:** apply migrations and deploy Edge Functions via the Supabase CLI

## Branching & Commits

- Do not commit `firmware/include/config.h` or any `.env` file — they are gitignored for a reason (device secrets).
- Keep commits focused on a single concern. Follow the existing conventional-commit style used in the log (`feat(...)`, `fix(...)`, `chore(...)`).
- Commit message should say *what* and *why*, not *how*.

## Code Style

- **Dashboard (TS/React):** follow the existing patterns. Run `npm run lint` before pushing. TypeScript types are checked via `npm run build` (`tsc -b`).
- **Firmware (C++/Arduino):** follow the surrounding style in `firmware/src/*` (namespaces for helpers, `String`/`ArduinoJson`, UPPER_CASE macros in headers). Narrow `#define`s into `config.h` / `pins.h` rather than scattering magic values in `main.cpp`.
- **DB schema:** new tables/columns are **snake_case** (e.g. `device_mac`, not `Device_MAC`). Frontend services must use snake_case DB paths.

## Environment Conventions (Firmware)

`firmware/platformio.ini` groups several build environments. Add a new standalone test as its own env with a dedicated `*_main.cpp` entry point rather than editing `main.cpp`:

| Env | Purpose |
|---|---|
| `esp32-s3-n16r8` | Production firmware (real HTTP POST) |
| `net-test` | Dry-run network path (`net_dry.cpp`) |
| `nfc-test` | NFC/UID read-only test |
| `i2c-scan` | I2C bus scan |

Keep production behavior in `main.cpp` and put throwaway experiments in a separate env so production isn't accidentally broken.

## Schema Migrations

- Add migrations in `supabase/migrations/` with incrementing `NNNN_descriptive_name.sql` prefixes, mirroring the existing 0001–0011 series.
- Include RLS policies for any new tables alongside the `CREATE TABLE`.
- Keep the public REST/gRPC API and Edge Function queries in sync with the actual column names.

## Development Flow

1. Branch off `main` for your change.
2. Implement, run the relevant checks (`npm run lint`, `npm run build` for the dashboard; build the affected firmware env).
3. Verify against the real environment where possible (taps against the `ingest-tap` Edge Function, realtime updates on the dashboard).
4. Open a PR with a clear description; link any docs you changed (see `docs/`).

## Things to Watch

- **Card layout do not change casually** — the MIFARE Classic sectors/blocks and the `{`-scan JSON parsing are tightly coupled between `tools/encode_card.py` and `firmware/src/nfc.cpp`. Read `docs/card-encoding.md` before touching either.
- **Only one active session per device** — `ingest-tap` resolves the active session via `.maybeSingle()`; leave the session-management queries consistent with that invariant.
- **Don't change device auth** without updating the paired secret on both sides (`DEVICE_PSK` in Supabase and `config.h`).
