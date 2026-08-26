-- ============================================================
-- 0009_one_open_session_per_course.sql
-- Nothing previously stopped two open (non-CLOSED) Active_Sessions
-- rows from existing for the same course at once. In practice this
-- happened from ad-hoc testing (a session never explicitly stopped),
-- and it surfaces as a confusing failure well after the fact: the
-- frontend's getActiveSession() uses .maybeSingle(), which tolerates
-- zero matching rows but still throws "JSON object requested,
-- multiple (or no) rows returned" the moment a second one exists —
-- meaning the actual bug (an orphaned session) and the error (a
-- generic PostgREST message on an unrelated later request) show up
-- nowhere near each other in time.
--
-- startSession() now closes any stale open session for a course
-- before starting a new one, so this shouldn't trigger in normal use
-- — this index is the database-level guarantee for any other path
-- (a bug, a direct insert, a future feature) that skips that check.
-- Partial (WHERE Status <> 'CLOSED') so any number of past CLOSED
-- sessions for the same course can coexist; only concurrently open
-- ones are restricted, same reasoning as the existing partial unique
-- index on Attendance_Logs (0002_attendance_thresholds.sql).
-- ============================================================
CREATE UNIQUE INDEX idx_active_sessions_one_open_per_course
    ON Active_Sessions (Stub_Code)
    WHERE Status <> 'CLOSED';
