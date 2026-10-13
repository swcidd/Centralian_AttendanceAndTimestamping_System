-- RLS controls which rows a role sees, not whether it may touch the table:
-- a base GRANT is still required. 0001 only created policies, not grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- So tables added by later migrations get the same grants automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
