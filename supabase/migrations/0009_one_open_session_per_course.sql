-- A database-level guarantee that at most one non-CLOSED session exists per
-- course. startSession() closes stale sessions first, but this covers any
-- other path. Partial so past CLOSED sessions can coexist.
CREATE UNIQUE INDEX idx_active_sessions_one_open_per_course
    ON Active_Sessions (Stub_Code)
    WHERE Status <> 'CLOSED';
