# Course ↔ Stubcode model (migration 0012)

## ER model

```
Professor (Profiles)          Course                    Stubcode
  1 ──────────────  N   1 ──────────────  N
   Instructor_ID             Course_ID (PK, UUID)
                              Stub_Code (PK, VARCHAR) ──> Course_ID (FK)
```

- A **professor** owns many courses (`Courses.Instructor_ID`, unchanged
  since 0001) and, through them, many stubcodes.
- A **course** has many stubcodes; a **stubcode** belongs to exactly one
  course. Before 0012 the two were fused — `Courses.Stub_Code` was the
  primary key, so every course could hold exactly one code.
- A stubcode carries **only its code**: schedule, terminal, and the
  late/absent thresholds stay on the course and are shared by all of
  its stubcodes.

## What the migration does

`supabase/migrations/0012_course_stubcode_normalization.sql`

1. Adds a surrogate `Course_ID UUID` PK to `Courses`.
2. Creates `Stubcodes(Stub_Code PK, Course_ID FK, Created_At)` and seeds
   every existing course's code as its first stubcode — all live
   `stub_code` values survive verbatim, so enrollments, sessions,
   attendance, device commands, pending registrations, and the edge
   functions' payloads are unaffected.
3. Re-points the five inbound FKs from `Courses(Stub_Code)` to
   `Stubcodes(Stub_Code)`, preserving per-table delete semantics
   (bookkeeping cascades; `Attendance_Logs` still blocks deletion).
4. RLS: new instructor-scoped `Stubcodes` policies; the two
   `Enrollments` ownership policies now resolve ownership through
   `Stubcodes → Courses`.
5. Replaces `finalize_absences()` so the threshold lookup joins through
   `Stubcodes`.
6. Drops the fused `Courses.Stub_Code` column.
7. Adds a one-open-session-per-**device** unique index (several stubcodes
   of one course share the course's single terminal), closing any
   pre-existing duplicate first.

## App-side behavior

- `fetchCourses()` embeds `stubs: string[]` on each course; course
  create still takes one stub code (it becomes the first stubcode) and
  **Add stubcode** on the course card adds more.
- **Tracking** and **Activity** filters cascade: picking a course lists
  only that course's stubcodes and auto-selects the first. Sessions,
  rosters, enrollment realtime streams, and attendance are all keyed to
  the selected stubcode.
- `startSession()` closes stale sessions by device *and* stub; the
  `ingest-tap` threshold lookup reads the course through the stub's FK
  (requires `supabase functions deploy ingest-tap`).

## Deletion semantics (migration 0013)

- **Stubcode delete**: each chip on the course card has an ✕. The page
  counts the stub's attendance rows first and the confirmation spells
  them out ("drop its N attendance records first"); the FK cascade
  removes roster, sessions, commands, pending registrations, and
  attendance before the stub row itself. A course must keep at least
  one stubcode — the last one is refused with a pointer to delete the
  course instead.
- **Course delete**: same flow across all of the course's stubcodes —
  confirmation names the record count, then everything beneath drops
  before the course row.
- `0013` changed `Attendance_Logs.Stub_Code` from NO ACTION (history
  used to block deletion outright) to ON DELETE CASCADE. Direct client
  deletes of attendance logs remain blocked by RLS — audit writes stay
  edge-function-only; only parent deletion purges.

## Deploy order

1. `supabase db push` (pending migrations — 0012, 0013)
2. `supabase functions deploy ingest-tap` (only when ingest-tap code
   changed, e.g. with 0012)
3. Deploy the frontend (Cloudflare) — the live site must match the
   schema, so keep the gap short.
