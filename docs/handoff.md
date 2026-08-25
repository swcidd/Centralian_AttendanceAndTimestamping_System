# NFCPass — Architecture & Implementation Handoff

## 1. System Overview & Problem Statement

**NFCPass** is an embedded hardware tracking system designed to replace slow, easily bypassed manual university attendance logging methods. The system features a dedicated micro-controller terminal equipped with an NFC module. Students tap physical ID cards on the terminal to register presence and compute timestamps.

- **Architecture Model:** Centralized Cloud / Pass-Through.
- **Core Philosophy:** Minimal edge complexity. The ESP32 microcontrollers perform zero local state management, schedule validation, or business logic. They function strictly as pass-through I/O peripherals.
- **Gated 2FA Session Flow:** Attendance tracking is triggered out-of-band. The instructor taps their physical ID card at the terminal, triggering a password challenge on the web dashboard. Upon successful login, an `ACTIVE_ATTENDANCE` session window (10–15 mins) is opened for that specific device.

## 2. Tech Stack & Software Ecosystem

| Layer | Selected Tech | Details & Purpose |
| --- | --- | --- |
| Microcontroller | ESP32-S3 N16R8 (DOIT devkit) | Wi-Fi-enabled controller for processing hardware interrupts and streaming JSON payloads over HTTPS. 16MB flash / 8MB octal PSRAM; I2C defaults to GPIO8/9 on this board, not the classic ESP32's GPIO21/22. |
| NFC Peripheral | PN532 (I2C Mode) | Reads ISO14443A card UIDs (DIP switches: SW1=ON, SW2=OFF). |
| Status LED | Onboard WS2812 RGB, GPIO48 (`STATUS_LED_PIN`) | Color+blink-coded tap-result feedback via `Adafruit_NeoPixel` (see §8): green=accepted, orange=no active session, red=rejected/invalid. No external wiring needed — it's the board's built-in addressable LED. |
| Embedded Environment | C++ via PlatformIO (VS Code) | Managed dependencies via `platformio.ini`, board pinouts, and NTP time sync. |
| Database & Realtime | Supabase (PostgreSQL) | Stores master student registers, handles RLS security, and broadcasts real-time attendance events. |
| Frontend Web App | React + TypeScript (Vite) | Declarative instructor dashboard for real-time room capacity and student tracking. |
| Web Hosting | Cloudflare Pages | Direct GitHub deployment bypassing local ISP (PLDT) domain blocks. |
| 3D / Enclosure CAD | Autodesk Fusion / Onshape | For modeling physical room terminal enclosures. |

## 3. Database Schema (PostgreSQL / Supabase)

See [`supabase/migrations/0001_core_schema.sql`](../supabase/migrations/0001_core_schema.sql) for the tracked, versioned schema. Summary of tables:

- `Instructors` — instructor identity + NFC UID for the 2FA gate tap
- `Students` — master register, `NFC_UID` unique per student
- `Devices` — terminal registry keyed by MAC address
- `Courses` — schedule + links to `Instructors` and `Devices`
- `Enrollments` — student ↔ course join table
- `Active_Sessions` — the `ACTIVE_ATTENDANCE` window opened per device after instructor 2FA
- `Attendance_Logs` — append-only tap records, realtime-enabled (`supabase_realtime` publication)

## 4. Hardware Security & Network Specification

To prevent device MAC address spoofing and replay attacks:

- **HMAC-SHA256 Signing:** Requests are signed using a Pre-Shared Key (PSK): `HMAC_SHA256(PSK, MAC + Timestamp + NFC_UID)`.
- **Replay Attack Defense:** API rejects transactions with a clock skew > 30 seconds relative to UTC NTP time.
- **Transport:** HTTPS POST encrypted data transmission.

### Key Firmware Payload Contract (ESP32 → Backend)

```json
{
  "device_mac": "24:62:AB:F3:89:10",
  "nfc_uid": "04A1B2C3D4",
  "timestamp": 1787572820,
  "signature": "c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298fc1c149afbf4"
}
```

HMAC verification, skew checking, and the insert into `Attendance_Logs` happen server-side in the Supabase Edge Function `supabase/functions/ingest-tap` — chosen over a dedicated Express/Fastify server to avoid a second hosting/deploy pipeline, consistent with the "minimal edge complexity" philosophy.

### Device Command Polling (ESP32 → Backend)

The device has no Supabase Auth session — only the PSK — so it can't read `Device_Commands` directly (`commands_select_authenticated` in `0001_core_schema.sql` is authenticated-only, and there's no client UPDATE policy for ACK at all — that's service-role only by design, per the table's own comment in §8). `supabase/functions/poll-commands` mirrors `ingest-tap`'s exact PSK-HMAC pattern instead of inventing a second trust model:

```json
{
  "device_mac": "24:62:AB:F3:89:10",
  "timestamp": 1787572820,
  "signature": "<HMAC_SHA256(PSK, device_mac + timestamp)>"
}
```

Response is `{ "command": { "command_type": "START_ATTENDANCE" | "END_SESSION", "stub_code": "..." } }` for the oldest `PENDING` row targeting that `device_mac`, or `{ "command": null }` when there's nothing queued. Fetch and ACK happen atomically in this one call — the device has no meaningful local state to reconcile later if a separate confirm step failed, so a two-phase poll-then-confirm round trip isn't worth the complexity here. The atomicity itself lives in `claim_next_device_command()` (`0005_claim_next_device_command.sql`), a `FOR UPDATE SKIP LOCKED` function called via `.rpc()` — not a plain select-then-update from the Edge Function, which can't be made atomic through the PostgREST query builder and would let two overlapping polls for the same device both claim the same row. Same "logic needing real transactional guarantees lives in a SQL function" reasoning as `finalize_absences()` (§6).

The HMAC/skew verification itself now lives in `supabase/functions/_shared/deviceAuth.ts`, shared by both `ingest-tap` and `poll-commands` so the anti-spoofing logic only exists in one place.

## 5. Repository Layout

The web app stays at the repository root (no `apps/web` workspace) so the existing Cloudflare Pages config (root dir `/`, build `npm run build`, output `dist`) needs zero changes.

```
/
├── src/                      # React + TS frontend (existing)
│   ├── lib/utils/            # Pure functional helpers (Result type, reducer, composition) — the FP layer for course grading
│   ├── lib/supabase.ts       # Supabase client singleton
│   ├── hooks/                # useRealtimeAttendance, etc.
│   └── services/             # attendanceApi.ts, validation.ts
├── firmware/                 # PlatformIO project (Phase 2)
├── supabase/                 # DB migrations + Edge Functions
└── docs/                     # This file + course planning worksheet
```

`firmware/include/config.h` (real WiFi/PSK secrets) is gitignored and generated locally per-developer from `firmware/include/config.h.example` — it is never committed.

## 6. Attendance Status & Absence Tracking

Each course can set two independent, optional thresholds (`Courses.Late_After_Minutes`, `Courses.Absent_After_Minutes`), both `NULL` (off) by default:

- **PRESENT / LATE** — written only by `ingest-tap`, only at the moment of a real physical tap. If the tap lands after `Started_At + Late_After_Minutes`, it's logged `LATE`; otherwise `PRESENT`. If `Late_After_Minutes` is unset, every tap is `PRESENT`.
- **ABSENT** — the one status ever written without a physical tap behind it. A `pg_cron` job (`finalize_absences()`, runs every minute) bulk-inserts an `ABSENT` row for every enrolled student with no row yet, once `Started_At + Absent_After_Minutes` passes for their session, then closes the session.

`Attendance_Logs` rows are never overwritten. Safety under the tap-vs-cron race is enforced by the database, not application timing: a partial unique index on `(Session_ID, Student_ID) WHERE Student_ID IS NOT NULL` guarantees one row per student per session — whichever write lands first wins, the other is a no-op. `NFC_UID`/`Device_MAC` are nullable specifically to allow `ABSENT` rows, which have no tap to source them from; a check constraint keeps every other status honest about requiring both.

## 7. Development Roadmap

- [x] **Phase 1: Cloud Architecture & Deployment** — Supabase schema, React + TS frontend UI shell, Cloudflare Pages deployment.
- [ ] **Phase 2: Firmware Implementation** — PN532 I2C wiring, NTP sync, HMAC-SHA256 signing, UID validation, and the tap→POST pipeline are implemented (see §8); still open: physical wiring/flashing on real hardware and an end-to-end tap → ESP32 → Supabase → dashboard verification.
- [ ] **Phase 3: Frontend Integration** — `TrackingPage` now shows a live roster: enrolled students fetched from Supabase, merged with the open session's `Attendance_Logs`, updated in real time via `useRealtimeAttendance` folded through the `attendanceReducer` pure reducer (`src/lib/utils/attendanceReducer.ts`, per `project-plan.md` §3). `sessionsApi.ts`'s `startSession`/`closeSession` now also queue a row in `Device_Commands` (`START_ATTENDANCE`/`END_SESSION`) — MVP dashboard→device signaling, deliberately decided over building the instructor 2FA/session-gate flow first; sessions still start via a manual dashboard button (`TrackingButton`), not the NFC-tap-triggers-password-challenge flow described in §1, which stays a later phase. `ingest-tap` remains the actual security gate regardless of whether a device ever polls its command — Device_Commands is a UX/mode signal, not an auth boundary. The backend half of that polling loop is now built (`supabase/functions/poll-commands`, see §4); firmware-side calling of it isn't (firmware territory). `ActivityPage`/`StudentTrackTable` still render hardcoded empty arrays (historical/summary views, not yet wired).

## 8. Firmware FP Concept Mapping

Per the FP concepts in `project-plan.md`, the firmware's tap pipeline (`firmware/src/main.cpp:loop()`) composes small functions, most of them pure, into a single predictable sequence — the "Single-Step Event Pipe" from the original worksheet:

`nfcReadUid()` (I/O) → `validateUidFormat()` (pure) → `signPayload()` (pure) → `postTapEvent()` (I/O) → `ledIndicateResult()` (I/O)

- **Pure function + `Result`-style error handling** — [`firmware/src/validation.h`](../firmware/src/validation.h) / [`validation.cpp`](../firmware/src/validation.cpp). `validateUidFormat()` takes a raw UID string and always returns the same `UidValidation{ok, uid, error}` for the same input, with no side effects. A malformed or wrong-length UID is rejected (logged + a distinct LED pattern) before it's ever signed or sent, without touching the network. Named to distinguish it from the differently-scoped `validateUid()` in [`src/services/validation.ts`](../src/services/validation.ts), which is the frontend's FP layer (`src/lib/utils/result.ts` `Result<T, E>`) checking whether a UID belongs to a *registered* student, not whether it's well-formed.
- **Pure function** — [`firmware/src/crypto.cpp`](../firmware/src/crypto.cpp). `signPayload()` is a deterministic HMAC computation with no I/O.
- **Composition** — `loop()` itself: each stage only runs if the previous one succeeded, and the network/HMAC logic never sees an unvalidated UID. Matches the pipeline shape already documented for the frontend's `pipe()`/`compose()` helpers in [`src/lib/utils/composition.ts`](../src/lib/utils/composition.ts) ("tap → validate → dedupe → timestamp → log").
