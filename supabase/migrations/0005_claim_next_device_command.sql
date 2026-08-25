-- ============================================================
-- 0005_claim_next_device_command.sql
-- poll-commands needs to atomically claim (read + ACK) the oldest
-- PENDING command for a device in one statement — a separate
-- SELECT then UPDATE from the Edge Function has a real race: two
-- concurrent polls for the same device (e.g. a retry overlapping
-- the original request) can both SELECT the same row before
-- either UPDATE lands, and both then return the same command.
--
-- FOR UPDATE SKIP LOCKED is the standard safe pattern for "claim
-- one row from a queue among concurrent claimers" — a concurrent
-- caller skips a row someone else already has locked instead of
-- blocking on it or double-claiming it. This isn't expressible
-- through the PostgREST query builder (no raw SQL / CTEs), so it
-- lives here as a function called via .rpc(), same reasoning as
-- finalize_absences() in 0002_attendance_thresholds.sql.
--
-- No SECURITY DEFINER: poll-commands calls this with the
-- service-role key, which already bypasses RLS on its own —
-- unlike finalize_absences() (invoked by pg_cron as the Postgres
-- role), there's no privilege gap to close here.
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_next_device_command(p_device_mac VARCHAR(50))
RETURNS TABLE (command_id UUID, stub_code VARCHAR(20), command_type VARCHAR(30))
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH claimed AS (
        SELECT dc.Command_ID
        FROM Device_Commands dc
        WHERE dc.Device_MAC = p_device_mac
          AND dc.Status = 'PENDING'
        ORDER BY dc.Created_At ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    UPDATE Device_Commands
    SET Status = 'ACKNOWLEDGED', Acknowledged_At = NOW()
    FROM claimed
    WHERE Device_Commands.Command_ID = claimed.Command_ID
    RETURNING Device_Commands.Command_ID, Device_Commands.Stub_Code, Device_Commands.Command_Type;
END;
$$;
