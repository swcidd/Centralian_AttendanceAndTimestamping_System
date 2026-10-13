-- Atomically claim (read + ACK) the oldest PENDING command for a device.
-- FOR UPDATE SKIP LOCKED is the standard safe "claim one row from a queue"
-- pattern, and isn't expressible through the PostgREST query builder.
-- No SECURITY DEFINER: the caller uses the service-role key.
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
