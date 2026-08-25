-- ============================================================
-- 0007_grant_service_role.sql
-- Edge Functions use the service_role key (SUPABASE_SERVICE_ROLE_KEY)
-- which bypasses RLS but still needs explicit PostgreSQL GRANTs
-- on each table.  Without this, the service_role gets
-- "permission denied for table X" even though RLS is irrelevant.
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

-- Functions also need EXECUTE grants for rpc() calls
-- (claim_next_device_command, etc.)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
