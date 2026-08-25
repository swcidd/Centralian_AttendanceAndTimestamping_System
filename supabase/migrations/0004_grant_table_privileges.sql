-- ============================================================
-- 0004_grant_table_privileges.sql
-- RLS policies only control which ROWS a role can see once it's
-- allowed to touch a table at all — the role still needs a base
-- Postgres GRANT to attempt the query in the first place. Our
-- earlier migrations only ever created RLS policies, never grants,
-- which is why "permission denied for table X" showed up even
-- though the matching SELECT policy exists and is correct.
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- So any table added by a future migration gets the same grants
-- automatically, without needing another migration like this one.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
