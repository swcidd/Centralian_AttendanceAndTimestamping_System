# CATS (NFCPass) — Project Log, Timeline & Usage Guide

> Live log of everything done on this project so far: a dated, commit-level
> timeline of every change, plus usage instructions for the features. This
> file is **dev-branch only** (see [Repository & branch workflow](#repository--branch-workflow)).

## What this system is

**Centralian Attendance & Timestamping System (CATS / NFCPass)** replaces
manual/QR attendance with a dedicated NFC hardware terminal. Students tap
their MIFARE Classic 1K ID cards on an ESP32-S3 + PN532 terminal at the
classroom door; the terminal posts tap events (HMAC-authenticated) to a
Supabase backend, which computes PRESENT/LATE/UNKNOWN and streams the live
roster to a React + Vite dashboard hosted on Cloudflare Pages.

| Layer | Tech | Where it lives |
|---|---|---|
| Terminal firmware | C++ (PlatformIO), ESP32-S3 N16R8 + PN532 (I2C) | `firmware/` |
| Card writer (desktop) | Python, nfcpy, ACR122U/PN532 USB reader | `tools/encode_card.py` |
| Local encoder bridge | Python stdlib HTTP server | `tools/encoder_server.py` |
| Backend | Supabase (PostgreSQL, RLS, Edge Functions) | `supabase/` |
| Dashboard | React + TypeScript (Vite 8), Cloudflare Pages | `src/` |
| Tests | Vitest 5.0.1 + @testing-library/react (jsdom) | `src/**/*.test.ts` |

## Repository & branch workflow

Three integration branches exist, all pushed:

| Branch | Purpose | Docs? |
|---|---|---|
| `main` | Working/deployable app (deploys to Cloudflare Pages) | No — `docs/` untracked |
| `staging` | Pre-deploy validation | No — `docs/` untracked |
| `dev` | Development environment — canonical home of all docs | Yes — `docs/` tracked |

Rules in force:

- Commits are **conventional** (`feat(component):`, `fix(component):`,
  `docs:`, `chore:`, `test:`, `build:`) and grouped per component so each
  change is independently revertable.
- Feature work branches off **`dev`** and merges back with `--no-ff`; the
  feature branch is deleted locally + remotely afterwards.
- `docs/`, `*.prompt.md`, and AI-agent folders are **gitignored on every
  branch**, so main/staging never carry them. New docs on dev must be added
  with `git add -f docs/...` (the ignore rule is shared). Re-merging docs
  back to main requires `git rm -r --cached docs/` first.
- Hardware-port kernel: NFC init before WiFi, `WiFi.setTxPower(WIFI_POWER_5dBm)`,
  `Wire.setClock(100000)`, USB CDC flags on all firmware envs.

## Complete change timeline

Every commit reachable from the branches, oldest first. Times are local
(author date). Merge commits are marked *(merge)*. Reverted work is noted.

### 2026-07-22 → 2026-08-24 — Initial dashboard UI (pre-hardware)

| Date/time | Commit | Change |
|---|---|---|
| 07-22 11:03 | `7dc1a6b` | Initial commit |
| 07-26 00:33 | `7b5c43d` | Basic layout with page switching |
| 08-03 11:34 | `c554f1b` | Update package-lock.json |
| 08-05 02:47 | `74772c0` | Create basic tracking page UI |
| 08-08 13:06 | `cb40e65` | Rename "attendance" → "tracking"; remove TrackingFilter backend |
| 08-09 16:40 | `eab759b` | Make sidebar toggleable |
| 08-10 12:33 | `62e7079` | Remove unused imports |
| 08-10 13:16 | `4a2efd8` | Remove unused imports (activity page) |
| 08-10 23:38 | `74a4065` | Create basic activity page UI |
| 08-10 23:41 | `916b03d` | Add padding to tracking page |
| 08-17 22:04 | `f051110` | Create basic courses page UI |
| 08-19 09:37 | `bce5f1c` | Initial commit (repo re-baseline) |
| 08-19 10:47 | `0ccc24d` | Move types to a separate types file |
| 08-19 10:47 | `4503888` | *(merge)* Merge branch 'main' |
| 08-19 13:45 | `b72a07a` | Reformat types; add StudentDetails component |
| 08-24 10:28 | `cb102a7` | Switch main page to tracking page |
| 08-24 10:37 | `a385737` | Fix sidebar text |
| 08-24 11:42 | `b03f041` | Add placeholder colors |
| 08-24 12:07 | `3c453d2` | Add colors to all pages; change course page layout |
| 08-24 14:28 | `0930208` | Add colors to student track details; fix courses page flex |

### 2026-08-25 — Auth, schema, ingest-tap logic, first firmware hardening

| Date/time | Commit | Change |
|---|---|---|
| 08-25 18:09 | `91aaee7` | Fix sidebar navigation |
| 08-25 18:34 | `eae979c` | *(merge)* Merge origin/main |
| 08-25 19:02 | `09dee7f` | Redesign activity page |
| 08-25 19:02 | `2d498ff` | *(merge)* Merge branch 'main' |
| 08-25 20:04 | `8e95166` | Redesign courses page |
| 08-25 20:20 | `a5637e6` | **feat(auth):** wire Login/Signup to Supabase Auth; gate dashboard routes |
| 08-25 20:51 | `f6cd22c` | **feat(schema):** configurable late/absent thresholds + pg_cron auto-absence |
| 08-25 20:52 | `8778306` | **feat(ingest-tap):** resolve session/student; compute PRESENT/LATE/UNKNOWN |
| 08-25 21:25 | `d548d79` | **refactor(schema):** rename migrations, trim dead columns, align types |
| 08-25 21:33 | `a69c3b6` | Style: rename website to "CPU" *(reverted)* |
| 08-25 22:32 | `c477f60` | Style: remove placeholder text from Login/Signup *(reverted)* |
| 08-25 22:37 | `b5ae4de` | Revert "rename website to CPU" |
| 08-25 22:47 | `303bb6a` | Revert "remove placeholder text" |
| 08-25 22:57 | `8c65b6b` | Clean up Cloudflare deploy, migration idempotency, mock data |
| 08-25 22:58 | `d9d4309` | Change page title |
| 08-25 23:13 | `cc0e03e` | **feat(courses):** wire Courses page to Supabase; make it the landing page |
| 08-25 23:21 | `9215f06` | **feat(db):** grant table privileges; wire course filters to Supabase |
| 08-25 23:34 | `b67f2f5` | **feat(courses,tracking):** wire course creation and session start/stop |
| 08-25 23:50 | `cfca5ac` | **fix(firmware):** harden ESP32/PN532 tap pipeline before hardware bring-up |

### 2026-08-26 — Firmware bring-up, device auth & polling, registration mode

| Date/time | Commit | Change |
|---|---|---|
| 08-26 00:08 | `41d0da0` | **fix(firmware):** configure for the actual DOIT ESP32-S3 N16R8 board |
| 08-26 01:19 | `fd74f31` | **feat(firmware):** standalone PN532 smoke-test environment |
| 08-26 01:48 | `922dae9` | **fix(courses):** normalize Device MAC to uppercase on course creation |
| 08-26 02:36 | `a509206` | **fix(firmware):** stop passing SDA/SCL as IRQ/RESET to Adafruit_PN532 |
| 08-26 03:33 | `2cca9b0` | **feat(firmware):** add net-test/i2c-scan envs; fix USB CDC + time_sync build |
| 08-26 04:17 | `c56c431` | **feat(tracking):** wire live attendance roster to Supabase + realtime |
| 08-26 04:33 | `e35e3d4` | **fix(firmware):** resolve WiFi+I2C power conflict; init NFC before WiFi |
| 08-26 04:44 | `a96cde7` | **feat(backend):** PSK-authenticated device command polling |
| 08-26 05:43 | `c832725` | **feat(firmware):** poll Device_Commands; surface session state via LED |
| 08-26 07:58 | `a2e62d0` | **fix(backend):** harden Edge Function auth and DB grants for device endpoints |
| 08-26 09:00 | `1363efd` | Set starting page after login to tracking page |
| 08-26 09:13 | `cb5eb15` | **feat(registration):** card-based student registration mode |
| 08-26 09:23 | `e45a600` | **fix(courses):** scope course visibility to owner; fix delete |
| 08-26 11:15 | `80c5a5a` | **feat(ui):** modal/overlay entrance animations; default hover transitions |
| 08-26 12:17 | `6efa48a` | **fix(tracking):** prevent duplicate open sessions per course |
| 08-26 13:18 | `e0b4a19` | **fix(firmware,backend):** auto-register students from pre-encoded cards during attendance |
| 08-26 13:24 | `f6cf774` | **fix(backend):** auto-register during ACTIVE_ATTENDANCE when card carries student_info |
| 08-26 13:44 | `2f81bf8` | **feat(schema):** use student-provided school_id as Student_ID (not UUID) |

### 2026-08-28 → 2026-09-02 — Search fix, card writer

| Date/time | Commit | Change |
|---|---|---|
| 08-28 23:18 | `1b55c32` | **feat(courses):** make the course search box actually filter |
| 09-02 10:54 | `ceaa267` | **firmware:** multi-key NFC auth, NDEF-aware JSON parsing, on-device card writer |

### 2026-09-17 — Docs, terminal assignment, test harness, branch strategy, card encoder

| Date/time | Commit | Change |
|---|---|---|
| 09-17 17:31 | `5b825f6` | **docs:** add project README and CONTRIBUTING guide |
| 09-17 17:31 | `ad22317` | **chore(supabase):** update CLI version stamp |
| 09-17 17:31 | `2aad4cd` | **fix(firmware):** I2C re-init + retry loop for NFC card write |
| 09-17 17:40 | `87719fa` | **feat(ui):** terminal assignment to course management |
| 09-17 21:38 | `6e46d16` | **chore(test):** add Vitest test harness (Vitest 5.0.1, jsdom) |
| 09-17 21:39 | `2e9e7db` | **fix(utils):** expose variadic `pipe` overload in the type signatures |
| 09-17 21:40 | `8e0845b` | **test(utils):** unit tests for the pure FP helpers |
| 09-17 21:40 | `28cea99` | **test(services):** unit tests for `validateUid` |
| 09-17 21:40 | `c3978a3` | **docs(testing):** reusable unit-test prompt |
| 09-17 21:48 | `4ea8f61` | *(merge)* Merge `feat/TerminalAssignment` into main (branch deleted after) |
| 09-17 23:21 | `d9d89b6` | **chore(build):** ignore docs and AI agent artifacts |
| 09-17 23:21 | `df94053` | **build(main):** untrack docs from deployment branches |
| 09-17 23:21 | `931d0fc` | **chore(build):** ignore docs/AI artifacts — dev head (`dev`) |
| 09-17 23:34 | `b4cfafa` | **feat(tools):** refactor `encode_card` into a reusable module + local encoder bridge (`tools/encoder_server.py`) |
| 09-17 23:34 | `56e314f` | **feat(ui):** public Encode Card page wired to the local encoder |
| 09-17 23:36 | `82fcceb` | **chore(build):** ignore Python bytecode; note forced-add rule for new docs |
| 09-17 23:36 | `be68910` | **docs(tools):** document the card encoder bridge |
| 09-17 23:41 | `69b4137` | **chore(build):** ignore `.venv/` created for the encoder tools |
| 09-17 23:41 | `37dd688` | **docs(tools):** install nfcpy via venv+pip; add `/health` check step |

### Branch heads (as of this log)

| Branch | HEAD | Date | Note |
|---|---|---|---|
| `main` | `df94053` | 2026-09-17 | Working app (docs untracked) |
| `staging` | `df94053` | 2026-09-17 | Pre-deploy (docs untracked) |
| `dev` | `931d0fc` (+ merge of `feat/card-encoder`) | 2026-09-17 | Development env, docs live here |

---

## How to use the features

### 1. Card encoder — write MIFARE cards from the web dashboard (works signed in or out)

The dashboard's **/encode page** writes `{school_id, first_name, last_name}`
onto a blank MIFARE Classic 1K card through a **local HTTP bridge**
(`tools/encoder_server.py`). It never touches Supabase, so encoding works
whether you are logged in or not.

```
Browser /encode page
   → fetch http://localhost:8787/encode  (student JSON)
   → tools/encoder_server.py  (Python stdlib HTTP server)
   → tools/encode_card.py::encode_student_on_card()
   → nfcpy → ACR122U / PN532 USB reader → MIFARE card
```

**One-time setup (machine with the USB NFC reader):**

```bash
python3 -m venv .venv                     # repo root; .venv/ is gitignored
.venv/bin/pip install nfcpy               # nfcpy is a LIBRARY — pipx won't work
```

**Start the bridge:**

```bash
.venv/bin/python tools/encoder_server.py                 # http://127.0.0.1:8787
ENCODER_PORT=9000 .venv/bin/python tools/encoder_server.py   # custom port
```

**Verify the reader is seen:**

```bash
curl -s http://127.0.0.1:8787/health      # expect {"ok":true,"nfcpy":true,"reader":true}
```

**Encode a card:**

1. Plug the reader in; place a **blank** MIFARE Classic card nearby.
2. Open the dashboard → **Encode Card** (login page link; also in the
   sidebar when signed in). The dot next to "Local encoder" should be green.
3. Fill in School ID / First Name / Last Name — keep it short; the payload
   must stay ≤ **96 bytes** (the page shows a live `N/96 bytes` counter).
4. Click **Write to card** and tap the card when the page says
   *"Waiting for a card…"*.
5. On success the card UID is shown. `GET /health` and the encoder page work
   the same over any origin (CORS enabled) — this is a loopback tool, so the
   browser and the reader must be on the same machine.

Endpoints: `GET /health`, `POST /encode`, `OPTIONS /encode` (preflight).
Errors: `400` bad body/missing fields, `409` card/auth/timeout, `503` nfcpy
missing. Details: [encoder-server.md](encoder-server.md),
[card-encoding.md](card-encoding.md).

### 2. Terminal assignment — bind a course to a terminal

- **Courses** page → a course card shows its assigned terminal; click
  **Assign/Change terminal** to open the modal.
- Choose from discovered devices (MAC + room) or enter a new MAC manually.
  MACs validate against the `B4:3A:45:A1:1D:0C`-style pattern and are
  normalized to uppercase.
- The assigned device is what `poll-commands` targets when an instructor
  starts/ends a session or registration mode.

### 3. Registration mode — enroll students by tapping cards

1. Start a course session from the dashboard, then issue
   **START_REGISTRATION** (via `Device_Commands` polling).
2. Have each student tap their **pre-encoded** MIFARE card at the terminal.
3. `ingest-tap` reads the UID **and** the embedded JSON
   (`school_id`, `first_name`, `last_name`), then creates the Student +
   Enrollment records (auto-register) — no manual entry.

### 4. Dashboard basics

- **Login/Signup** — Supabase Auth; `/` redirects to `/login`.
- **Tracking** — live roster per session (realtime), start/stop attendance
  per course; a course can only have one open session.
- **Activity** — per-student attendance history.
- **Courses** — create/manage courses, assign terminals, search/filter.

### 5. Test, lint, build

```bash
npm test        # 33 tests, 5 files (Vitest, node env)
npm run lint    # 2 pre-existing errors in TrackingPage/ActivityPage (untouched)
npm run build   # Vite production build → dist/ (Cloudflare Pages)
```

### 6. Deploy flow

1. Work on `dev` / feature branches; merge to `dev`.
2. Validate on `staging`, then fast-forward/merge to `main`.
3. Cloudflare Pages auto-deploys `main` (`npm run build`). Re-run
   `git rm -r --cached docs/` before a dev→main merge to keep docs off main.

## Where to go for more

| Doc (dev only) | Covers |
|---|---|
| `docs/handoff.md` | Full architecture, schema, Edge Functions, firmware, LED codes |
| `docs/card-encoding.md` | MIFARE card format (blocks, keys, 96-byte layout) |
| `docs/registration-mode-handoff.md` | Registration flow end-to-end |
| `docs/encoder-server.md` | Encoder bridge endpoints, troubleshooting, security |
| `docs/unit-test-prompt.md` | Reusable agent prompt for writing unit tests |
| `docs/project-plan.md` | Original sprint plan (roles, objectives) |