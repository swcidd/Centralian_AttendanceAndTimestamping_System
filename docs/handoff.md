# NFCPass — Architecture & Implementation Handoff

## 1. System Overview & Problem Statement

**NFCPass** is an embedded hardware tracking system designed to replace slow, easily bypassed manual university attendance logging methods. The system features a dedicated micro-controller terminal equipped with an NFC module. Students tap physical ID cards on the terminal to register presence and compute timestamps.

- **Architecture Model:** Centralized Cloud / Pass-Through.
- **Core Philosophy:** Minimal edge complexity. The ESP32 microcontrollers perform zero local state management, schedule validation, or business logic. They function strictly as pass-through I/O peripherals.
- **Gated 2FA Session Flow:** Attendance tracking is triggered out-of-band. The instructor taps their physical ID card at the terminal, triggering a password challenge on the web dashboard. Upon successful login, an `ACTIVE_ATTENDANCE` session window (10–15 mins) is opened for that specific device.

## 2. Tech Stack & Software Ecosystem

| Layer | Selected Tech | Details & Purpose |
| --- | --- | --- |
| Microcontroller | ESP32 | Wi-Fi-enabled controller for processing hardware interrupts and streaming JSON payloads over HTTPS. |
| NFC Peripheral | PN532 (I2C Mode) | Reads ISO14443A card UIDs (DIP switches: SW1=ON, SW2=OFF). |
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
- [ ] **Phase 2: Firmware Implementation** — Wire PN532 over I2C (SDA→GPIO21, SCL→GPIO22), NTP sync on boot, `mbedtls/md.h` HMAC-SHA256, end-to-end verify: tap → ESP32 HTTPS POST → Supabase → dashboard live update.
- [ ] **Phase 3: Frontend Integration** — Wire `src/lib/supabase.ts`, realtime subscription, instructor 2FA/session-gate UI, FP-layer implementations (currently stubs).
